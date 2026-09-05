import { Hono } from "hono";
import { prisma } from "@openmaths/db";
import type { Prisma } from "@openmaths/db";
import { canvasAccessWhere, requireCanvasRole } from "@openmaths/db/canvasAccess";
import { checkRateLimit } from "@openmaths/db/auth/rateLimit";
import { getUserBudgetStatus } from "@openmaths/db/budget";
import { notifyUsageCapWarning, notifyGenerationFinished } from "@openmaths/db/notifications";
import { buildGenerationContext } from "@openmaths/db/board/context";
import { syncGraphNode, getConnectedDiagramTitles } from "@openmaths/db/board/graphSync";
import { getInheritedWebLinks, syncWebLinkNodes, extractDomain } from "@openmaths/db/board/webLinkSync";
import { GenerationError, type Form } from "@openmaths/shared/ai/envelope";
import type { MessageAttachment } from "@openmaths/shared/ai/attachments";
import { getModelCapabilities } from "@openmaths/shared/ai/modelCapabilities";
import { validateAttachments } from "@openmaths/shared/ai/attachmentLimits";
import { wasAlreadyProcessed } from "@openmaths/shared/ai/requestDedupe";
import { formatPersonalization } from "@openmaths/shared/ai/personalization";
import { findBuiltInSkill } from "@openmaths/shared/ai/skills";
import { generateAnswerStream, type ReasoningEffort } from "../lib/ai/generate";
import { hackAi, IMAGE_FILE_MODEL_ID } from "../lib/ai/client";
import { requireAuth } from "../middleware/auth";

export const messageRoutes = new Hono();

const encoder = new TextEncoder();
function ndjson(obj: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(obj)}\n`);
}

// Ported verbatim from app's src/app/api/blocks/[blockId]/messages/route.ts
// (PRD "Split into app + server" P3-continued round 7).
messageRoutes.post("/blocks/:blockId/messages", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const attachments: MessageAttachment[] = Array.isArray(body?.attachments) ? body.attachments : [];
  const casual = body?.casual === true;
  const webSearch = body?.webSearch === true;
  const skillId = typeof body?.skillId === "string" ? body.skillId : null;
  const requestId = typeof body?.requestId === "string" ? body.requestId : null;

  if (!content) {
    return c.json({ error: "content is required" }, 400);
  }
  const attachmentError = validateAttachments(attachments);
  if (attachmentError) {
    return c.json({ error: attachmentError }, 413);
  }

  // Cost control (PRD v2 §9): each generation is at least one billed LLM call (often two, plus a
  // verification pass) — 20 per 5 minutes is generous for genuine back-and-forth use but stops a
  // runaway loop/script from running up real cost unattended.
  const rateLimit = await checkRateLimit(`messages:${user.id}`, 20, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `You're sending messages too quickly — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const block = await prisma.block.findFirst({
    where: { id: blockId, canvas: canvasAccessWhere(user) },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!block) return c.json({ error: "Block not found" }, 404);
  // Generation is a mutation (creates messages, sometimes a connected diagram) — Viewer/Commenter
  // can read a canvas but not trigger new AI generations on it (PRD §7).
  if (!(await requireCanvasRole(user, block.canvasId, "editor"))) {
    return c.json({ error: "You don't have permission to edit this canvas" }, 403);
  }

  // Budget cap (PRD §4.4) — a hard-stop blocks generation with a clear message before any tokens
  // are spent; a warn-level status is allowed through (the live meter surfaces it, and a one-time
  // notification fires below) — never a silent block, never a surprise bill past the cap.
  const budgetBefore = await getUserBudgetStatus(user.id);
  if (budgetBefore.status === "hard-stop") {
    return c.json(
      {
        error: `You've used your AI budget for this month ($${budgetBefore.spentUsd.toFixed(2)} of $${budgetBefore.budgetUsd.toFixed(2)}). It resets at the start of next month.`,
        budget: budgetBefore,
      },
      402
    );
  }

  // This block's own prior turns — without this, every follow-up loses all memory of
  // what was already asked/answered in this same node (the "continuous chat" bug).
  const history = block.messages
    .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
    .map((m) => ({ role: m.role as "USER" | "ASSISTANT", content: m.content }));

  if (block.kind === "GRAPH" || block.kind === "NOTE" || block.kind === "LINK") {
    return c.json({ error: `${block.kind} blocks don't have a chat` }, 400);
  }

  const hasImage = attachments.some((a) => a.type === "image");
  const hasFile = attachments.some((a) => a.type === "file");
  const hasExistingGraph = await prisma.connection.findFirst({
    where: { sourceBlockId: blockId, target: { kind: "GRAPH" } },
  });

  // Per-task default models (Settings > Model): an attachment kind or an existing connected
  // diagram picks the resolved model before we fall back to the account-wide default — this is
  // what "resolvedModelId" is used for everywhere below, not the block's own persisted modelId.
  const resolvedModelId =
    hasImage || hasFile
      ? IMAGE_FILE_MODEL_ID
      : (block.modelId ??
        (hasExistingGraph ? user.drawingModelId : null) ??
        user.defaultModelId ??
        undefined);

  const capabilities = getModelCapabilities(resolvedModelId);
  if ((hasImage && !capabilities.vision) || (hasFile && !capabilities.pdf)) {
    return c.json({ error: "The selected model doesn't support this attachment type" }, 400);
  }

  let skillInstructions: string | undefined;
  if (skillId) {
    const builtIn = findBuiltInSkill(skillId);
    if (builtIn) {
      skillInstructions = builtIn.instructions;
    } else {
      const customSkill = await prisma.skill.findFirst({ where: { id: skillId, userId: user.id } });
      skillInstructions = customSkill?.instructions;
    }
  }

  const existingDiagrams = await getConnectedDiagramTitles(blockId);

  const userMessage = await prisma.message.create({
    data: {
      blockId,
      role: "USER",
      content,
      attachments: attachments.length > 0 ? (attachments as unknown as Prisma.InputJsonValue) : undefined,
    },
  });

  const isFirstQuestion = !block.prompt;
  await prisma.block.update({
    where: { id: blockId },
    data: {
      status: "GENERATING",
      prompt: isFirstQuestion ? content : block.prompt,
    },
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The client can disconnect mid-generation (tab closed, navigated away) at any point —
      // when it does, the underlying controller is closed by the runtime out from under us, and
      // a bare `controller.enqueue`/`.close()` throws "Invalid state: Controller is already
      // closed". That throw landing in the catch block below would itself throw again on its own
      // enqueue call, which used to overwrite the block with that confusing message even though
      // generation (and the DB write) had already succeeded. Swallow it here instead.
      let clientDisconnected = false;
      function safeEnqueue(obj: unknown) {
        try {
          controller.enqueue(ndjson(obj));
        } catch {
          clientDisconnected = true;
        }
      }
      safeEnqueue({ type: "start", userMessage });
      const phaseStart = Date.now();
      let lastPhaseAt = phaseStart;
      function logPhase(name: string) {
        const now = Date.now();
        console.log(`[messages:${blockId}] ${name}: ${now - lastPhaseAt}ms (total ${now - phaseStart}ms)`);
        lastPhaseAt = now;
      }
      try {
        // PRD "Performance Audit & Answer-Rendering Fix" B8 — context build, link lookup, and
        // search all run concurrently rather than fully sequential.
        const [initialContext, connectedLinks] = await Promise.all([
          buildGenerationContext(blockId),
          getInheritedWebLinks(blockId),
        ]);
        let contextBlocks = initialContext;
        const newWebLinkUrls: string[] = [];

        // Reverse case: a LINK node connected INTO this question (or into one of its ancestor
        // questions — sub-questions inherit the parent's connected sites) means "search this
        // specific site for this" — restrict Exa to that domain rather than the open web. Capped
        // at 3 sites so a heavily-linked question doesn't balloon generation latency.
        const siteDomains = connectedLinks
          .slice(0, 3)
          .map((link) => extractDomain(link.url))
          .filter((domain): domain is string => !!domain);

        const [siteBlocks, webSearchResult] = await Promise.all([
          Promise.all(
            siteDomains.map(async (domain): Promise<string | null> => {
              try {
                const result = await hackAi.exa.answer({ query: content, includeDomains: [domain] });
                const answer = typeof result.answer === "string" ? result.answer : "";
                return answer ? `Live search of ${domain} (a site you're connected to) for "${content}":\n${answer}` : null;
              } catch (err) {
                console.error(`[messages] site-restricted search failed for ${domain}:`, err);
                return null;
              }
            })
          ),
          webSearch
            ? (async (): Promise<{ webBlock: string; urls: string[] } | null> => {
                try {
                  const result = await hackAi.exa.answer({ query: content });
                  const answer = typeof result.answer === "string" ? result.answer : "";
                  const citations = Array.isArray(result.citations) ? result.citations : [];
                  const citationRecords = citations
                    .map((cite) => (cite && typeof cite === "object" ? (cite as Record<string, unknown>) : null))
                    .filter((cite): cite is Record<string, unknown> => cite !== null);
                  const sources = citationRecords
                    .map((cite) => `- ${typeof cite.title === "string" ? cite.title : "Source"}: ${cite.url ?? ""}`)
                    .join("\n");
                  const urls = citationRecords
                    .map((cite) => (typeof cite.url === "string" ? cite.url : null))
                    .filter((u): u is string => !!u);
                  if (!answer) return { webBlock: "", urls };
                  return {
                    webBlock: `Live web search results for "${content}":\n${answer}${sources ? `\n\nSources:\n${sources}` : ""}`,
                    urls,
                  };
                } catch (err) {
                  console.error("[messages] web search failed:", err);
                  return null;
                }
              })()
            : Promise.resolve(null),
        ]);

        // Same final ordering as before parallelizing: web block (if any) first, then the
        // original context, then each site-restricted block in link order.
        for (const siteBlock of siteBlocks) {
          if (siteBlock) contextBlocks = contextBlocks ? `${contextBlocks}\n\n${siteBlock}` : siteBlock;
        }
        if (webSearchResult) {
          if (webSearchResult.webBlock) {
            contextBlocks = contextBlocks ? `${webSearchResult.webBlock}\n\n${contextBlocks}` : webSearchResult.webBlock;
          }
          newWebLinkUrls.push(...webSearchResult.urls);
        }
        logPhase("context+search");
        const gen = generateAnswerStream({
          prompt: content,
          contextBlocks,
          modelId: resolvedModelId,
          reasoningEffort: (block.reasoningEffort as ReasoningEffort | null) ?? undefined,
          attachments,
          history,
          personalization: formatPersonalization(user.personalization),
          casual,
          skillInstructions,
          existingDiagrams,
        });

        let step = await gen.next();
        while (!step.done) {
          safeEnqueue(step.value);
          step = await gen.next();
        }
        const { envelope, usage, verificationCorrected } = step.value;
        logPhase("generation");
        // Telemetry signal (PRD v2 §9): which representation the model reached for, so the
        // learning-funnel/cost dashboard can see the mix over time, not just guess from prose.
        const formKind = envelope.forms && envelope.forms.length > 0
          ? "forms"
          : envelope.needsGraph
            ? "geometry"
            : envelope.table
              ? "table"
              : envelope.solution && envelope.solution.length > 0
                ? "solution_steps"
                : "prose";

        const assistantMessage = await prisma.message.create({
          data: {
            blockId,
            role: "ASSISTANT",
            content: envelope.answerMarkdown,
            solution: envelope.solution as unknown as Prisma.InputJsonValue,
            finalAnswer: envelope.finalAnswer,
            table: envelope.table as unknown as Prisma.InputJsonValue,
            forms: envelope.forms as unknown as Prisma.InputJsonValue,
          },
        });

        const updated = await prisma.block.update({
          where: { id: blockId },
          data: {
            status: "READY",
            errorMessage: null,
            modelId: resolvedModelId,
            title: !block.title && envelope.title ? envelope.title : undefined,
          },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });

        // PRD v2 §5 — forms[] geometry/plot entries each get their own connected GRAPH node, one
        // syncGraphNode call per form.
        const formDiagrams: Extract<Form, { kind: "geometry" | "plot" }>[] = (envelope.forms ?? []).filter(
          (f): f is Extract<Form, { kind: "geometry" | "plot" }> => f.kind === "geometry" || f.kind === "plot"
        );

        const [graphSyncResults, webLinkSync] = await Promise.all([
          formDiagrams.length > 0
            ? Promise.all(
                formDiagrams.map((f) =>
                  syncGraphNode({
                    canvasId: block.canvasId,
                    questionBlockId: blockId,
                    questionPositionX: block.positionX,
                    questionPositionY: block.positionY,
                    scene: f.scene,
                    title: f.title ?? envelope.title ?? block.title ?? undefined,
                    diagramTitle: f.title,
                  })
                )
              )
            : envelope.needsGraph && envelope.scene
              ? syncGraphNode({
                  canvasId: block.canvasId,
                  questionBlockId: blockId,
                  questionPositionX: block.positionX,
                  questionPositionY: block.positionY,
                  scene: envelope.scene,
                  title: envelope.title ?? block.title ?? undefined,
                  diagramTitle: envelope.diagramTitle,
                }).then((r) => [r])
              : Promise.resolve([]),
          syncWebLinkNodes({
            canvasId: block.canvasId,
            questionBlockId: blockId,
            questionPositionX: block.positionX,
            questionPositionY: block.positionY,
            urls: newWebLinkUrls,
          }),
        ]);
        const graphBlock = graphSyncResults[0]?.graphBlock ?? null;
        const graphConnection = graphSyncResults[0]?.connection ?? null;
        const graphSyncs = graphSyncResults.map((r) => ({ graphBlock: r.graphBlock, graphConnection: r.connection }));
        logPhase("persist+sync");

        // usage covers EVERY attempt actually billed for this call. Skipped entirely when this
        // exact requestId was already billed (§4.3 idempotency) — the answer still streams back
        // either way.
        if (!wasAlreadyProcessed(requestId)) {
          await prisma.activityEvent.createMany({
            data: usage.map((u) => ({
              userId: user.id,
              blockId,
              canvasId: block.canvasId,
              type: "BLOCK_GENERATED" as const,
              metadata: {
                modelId: u.modelId,
                promptTokens: u.promptTokens,
                completionTokens: u.completionTokens,
                totalTokens: u.totalTokens,
                costUsd: u.costUsd,
                estimated: u.estimated,
                formKind,
                verificationCorrected,
              },
            })),
          });

          // Fire the warn-threshold notification once, at the moment this generation is what
          // pushed spend over 80% — not on every generation after that.
          if (budgetBefore.status === "ok") {
            const budgetAfter = await getUserBudgetStatus(user.id);
            if (budgetAfter.status !== "ok") {
              await notifyUsageCapWarning({
                userId: user.id,
                percentUsed: Math.round((budgetAfter.spentUsd / budgetAfter.budgetUsd) * 100),
                hardStop: budgetAfter.status === "hard-stop",
              }).catch(() => {});
            }
          }
        }

        safeEnqueue({
          type: "done",
          block: updated,
          userMessage,
          assistantMessage,
          graphBlock,
          graphConnection,
          graphSyncs,
          webLinkBlock: webLinkSync.block,
          webLinkConnection: webLinkSync.connection,
          webLinkSkipped: webLinkSync.skipped,
        });

        // The client was gone by the time the answer was ready — tell them via the bell instead.
        if (clientDisconnected) {
          const canvas = await prisma.canvas.findUnique({ where: { id: block.canvasId }, select: { title: true } });
          await notifyGenerationFinished({
            userId: user.id,
            canvasId: block.canvasId,
            canvasTitle: canvas?.title ?? "Untitled canvas",
            blockTitle: updated.title,
          }).catch(() => {});
        }
      } catch (err) {
        const message = err instanceof GenerationError ? err.message : (err as Error).message;
        const updated = await prisma.block.update({
          where: { id: blockId },
          data: { status: "ERROR", errorMessage: message },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });
        safeEnqueue({ type: "error", block: updated, userMessage, error: message });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed by a client disconnect — nothing to do
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
});
