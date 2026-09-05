import { Hono } from "hono";
import type { ChatMessage } from "@razinmohammedpt/hackai-sdk";
import { renderToStream } from "@react-pdf/renderer";
import { prisma } from "@openmaths/db";
import type { Prisma } from "@openmaths/db";
import { canvasAccessWhere, requireCanvasRole } from "@openmaths/db/canvasAccess";
import { checkRateLimit } from "@openmaths/db/auth/rateLimit";
import { validateAudioDataUrl } from "@openmaths/shared/ai/attachmentLimits";
import { apiBlockToBlockData } from "@openmaths/shared/board/apiMappers";
import { hackAi, DEFAULT_MODEL_ID } from "../lib/ai/client";
import { runDiagramAttempt } from "../lib/ai/generate";
import { recordUsage } from "../lib/ai/usage";
import { BlockDocument } from "../lib/pdf/BlockDocument";
import { requireAuth } from "../middleware/auth";

// Ported verbatim from app's src/app/api/blocks/[blockId]/{explain-step,redraw,transcribe,export-pdf}
// (PRD "Split into app + server" P3-continued round 8).
export const blockGenerationRoutes = new Hono();

/**
 * "Explain more" on a single solution step — deliberately read-only (Viewer/Commenter can use it,
 * unlike /messages) — it reads the existing answer and expands on it in place, never mutates the
 * block.
 */
blockGenerationRoutes.post("/blocks/:blockId/explain-step", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");

  const block = await prisma.block.findFirst({ where: { id: blockId, canvas: canvasAccessWhere(user) } });
  if (!block) return c.json({ error: "Block not found" }, 404);

  const rateLimit = await checkRateLimit(`explain-step:${user.id}`, 30, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `Too many requests — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const claim = typeof body?.claim === "string" ? body.claim : "";
  const detail = typeof body?.detail === "string" ? body.detail : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const otherSteps = Array.isArray(body?.otherSteps) ? body.otherSteps.filter((s: unknown) => typeof s === "string") : [];
  if (!claim) return c.json({ error: "claim is required" }, 400);

  const completion = await hackAi.chat.completions.create({
    model: user.defaultModelId ?? DEFAULT_MODEL_ID,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          "A student is looking at one step of a worked math solution and wants a deeper explanation of just that step — not the whole problem re-solved, not a restatement, an actual elaboration a patient tutor would give when a student says \"I don't get this step.\" Ground it in the theorem/definition/technique the step relies on, work through why it's true (not just that it's true), and connect it to what came right before it if that's what makes it click. 2-5 sentences, conversational, not a list. Use $...$ for inline math and $$...$$ for block math (KaTeX) wherever it helps. Respond with ONLY the explanation markdown — no preamble, no code fences, no restating the original claim verbatim first.",
      },
      {
        role: "user",
        content: [
          `The problem: ${block.prompt}`,
          otherSteps.length > 0 ? `Earlier steps already established:\n${otherSteps.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}` : "",
          `The step to explain further: "${claim}"`,
          detail ? `Its working: ${detail}` : "",
          reason ? `Its stated justification: ${reason}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!text) return c.json({ error: "The model returned nothing" }, 502);

  return c.json({ text });
});

/**
 * "Redraw / regenerate this diagram" — re-runs ONLY the diagram-drawing stage against the parent
 * question's ALREADY-DECIDED answer, so a redraw can't accidentally change what the answer says,
 * only how the figure illustrating it looks.
 */
blockGenerationRoutes.post("/blocks/:blockId/redraw", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");

  const graphBlock = await prisma.block.findFirst({ where: { id: blockId, kind: "GRAPH", canvas: canvasAccessWhere(user) } });
  if (!graphBlock) return c.json({ error: "Diagram not found" }, 404);
  if (!(await requireCanvasRole(user, graphBlock.canvasId, "editor"))) {
    return c.json({ error: "You don't have permission to edit this canvas" }, 403);
  }

  const rateLimit = await checkRateLimit(`redraw:${user.id}`, 20, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `You're redrawing too quickly — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  // A GRAPH block has exactly one incoming connection, from the question it illustrates.
  const incoming = await prisma.connection.findFirst({
    where: { targetBlockId: blockId },
    include: {
      source: {
        include: { messages: { where: { role: "ASSISTANT" }, orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });
  const question = incoming?.source;
  const latestAnswer = question?.messages[0];
  if (!question || !latestAnswer) {
    return c.json({ error: "Couldn't find the question this diagram illustrates" }, 400);
  }

  await prisma.block.update({ where: { id: blockId }, data: { status: "GENERATING" } });

  try {
    const { scene } = await runDiagramAttempt(
      {
        answerMarkdown: latestAnswer.content,
        solution: (latestAnswer.solution as { claim: string; detail?: string; reason?: string }[] | null) ?? undefined,
        finalAnswer: latestAnswer.finalAnswer ?? undefined,
        needsGraph: true,
        diagramTitle: graphBlock.title?.replace(/^Diagram:\s*/i, "").trim(),
      },
      question.prompt,
      question.modelId || DEFAULT_MODEL_ID
    );

    if (!scene) {
      await prisma.block.update({ where: { id: blockId }, data: { status: "READY" } });
      return c.json({ error: "Couldn't redraw this diagram — the model didn't return a usable figure. Try again." }, 502);
    }

    const updated = await prisma.block.update({
      where: { id: blockId },
      data: { scene: scene as unknown as Prisma.InputJsonValue, status: "READY" },
    });

    await prisma.activityEvent.create({
      data: { userId: user.id, blockId, canvasId: graphBlock.canvasId, type: "BLOCK_GENERATED", metadata: { kind: "redraw" } },
    });

    return c.json({ block: updated });
  } catch (err) {
    await prisma.block.update({ where: { id: blockId }, data: { status: "READY" } });
    console.error("[redraw] failed:", err);
    return c.json({ error: "Couldn't redraw this diagram — try again." }, 500);
  }
});

// The Replicate STT models this route used previously have been removed from the proxy's catalog.
// Voxtral is a genuinely different, working path — an audio-input CHAT model reached through the
// normal chat-completions endpoint, not Replicate.
const STT_MODEL_ID = "mistralai/voxtral-small-24b-2507";

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

/** "audio/wav" -> "wav", "audio/webm;codecs=opus" -> "webm" — Voxtral's input_audio.format wants
 * a bare extension, not a MIME type. */
function formatFromMime(mime: string): string {
  const subtype = mime.split("/")[1] ?? "wav";
  return subtype.split(";")[0];
}

function extractText(output: unknown): string | null {
  if (typeof output === "string") return output.trim() || null;
  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    if (typeof record.text === "string") return record.text.trim() || null;
    if (typeof record.transcription === "string") return record.transcription.trim() || null;
  }
  return null;
}

blockGenerationRoutes.post("/blocks/:blockId/transcribe", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const audioDataUrl = typeof body?.audioDataUrl === "string" ? body.audioDataUrl : null;

  if (!audioDataUrl) {
    return c.json({ error: "audioDataUrl is required" }, 400);
  }
  const parsed = parseDataUrl(audioDataUrl);
  if (!parsed) {
    return c.json({ error: "audioDataUrl must be a base64 data URL" }, 400);
  }
  const audioSizeError = validateAudioDataUrl(audioDataUrl);
  if (audioSizeError) {
    return c.json({ error: audioSizeError }, 413);
  }

  const rateLimit = await checkRateLimit(`transcribe:${user.id}`, 15, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `Too many voice notes — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const block = await prisma.block.findFirst({ where: { id: blockId, canvas: canvasAccessWhere(user) } });
  if (!block) return c.json({ error: "Block not found" }, 404);
  if (!(await requireCanvasRole(user, block.canvasId, "editor"))) {
    return c.json({ error: "You don't have permission to edit this canvas" }, 403);
  }

  try {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe this audio verbatim. Reply with only the transcript, no commentary, no quotation marks." },
          { type: "input_audio", input_audio: { data: parsed.base64, format: formatFromMime(parsed.mime) } },
        ],
      },
    ] as unknown as ChatMessage[];

    const response = await hackAi.chat.completions.create({
      model: STT_MODEL_ID,
      messages,
      temperature: 0,
      // Mistral's API rejects temperature:0 (greedy sampling) unless top_p is explicitly 1.
      top_p: 1,
    });
    const transcript = extractText(response.choices?.[0]?.message?.content);
    if (!transcript) {
      console.error("[transcribe] model returned no usable text:", JSON.stringify(response).slice(0, 500));
      return c.json({ error: "Didn't catch any speech in that recording — try again." }, 502);
    }

    const usage = await recordUsage(STT_MODEL_ID, response.usage, false);
    await prisma.activityEvent.create({
      data: {
        userId: user.id,
        blockId,
        canvasId: block.canvasId,
        type: "BLOCK_GENERATED",
        metadata: {
          modelId: usage.modelId,
          kind: "stt",
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          costUsd: usage.costUsd,
          estimated: usage.estimated,
        },
      },
    });

    return c.json({ transcript });
  } catch (err) {
    console.error("[transcribe] STT call failed:", err);
    return c.json({ error: "Voice transcription failed — check your connection and try again." }, 502);
  }
});

blockGenerationRoutes.post("/blocks/:blockId/export-pdf", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const diagramImageDataUrl = typeof body?.diagramImageDataUrl === "string" ? body.diagramImageDataUrl : undefined;

  const block = await prisma.block.findFirst({
    where: { id: blockId, canvas: canvasAccessWhere(user) },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!block) return c.json({ error: "Block not found" }, 404);

  const blockData = apiBlockToBlockData(block);
  const stream = await renderToStream(<BlockDocument block={blockData} diagramImageDataUrl={diagramImageDataUrl} />);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  await prisma.activityEvent.create({
    data: { userId: user.id, blockId, type: "BLOCK_EXPORTED_PDF" },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${(blockData.title || blockData.prompt || "question").slice(0, 60)}.pdf"`,
    },
  });
});
