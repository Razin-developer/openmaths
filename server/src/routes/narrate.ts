import { Hono } from "hono";
import { prisma } from "@openmaths/db";
import type { Prisma } from "@openmaths/db";
import { canvasAccessWhere, requireCanvasRole } from "@openmaths/db/canvasAccess";
import { checkRateLimit } from "@openmaths/db/auth/rateLimit";
import { buildNarrationScript, hashScript } from "@openmaths/shared/speech";
import type { SolutionStep, TableForm } from "@openmaths/shared/ai/envelope";
import type { Scene } from "@openmaths/shared/dsl/types";
import { synthesizeSpeech, TTS_VOICE, TTS_MODEL_ID } from "../lib/ai/tts";
import { requireAuth } from "../middleware/auth";

export const narrateRoutes = new Hono();

interface NarrationClip {
  step: number;
  audioUrl: string;
  text: string;
}

interface NarrationCache {
  voice: string;
  scriptHash: string;
  clips: NarrationClip[];
}

const encoder = new TextEncoder();
function ndjson(obj: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(obj)}\n`);
}

/**
 * Server-side idempotency lock (PRD "Fullscreen Player & Animation UX" §5.1) — defense-in-depth
 * behind the client's own in-flight dedup (narrationStore.ts), for the case where two separate
 * clients (two tabs, two devices) hit the same block+script at once.
 */
const inFlightSynthesis = new Map<string, Promise<NarrationClip[]>>();

async function synthesizeAll(
  script: { step: number; text: string }[],
  onClip: (clip: NarrationClip) => void
): Promise<NarrationClip[]> {
  const clips: NarrationClip[] = [];
  for (const s of script) {
    try {
      const audioUrl = await synthesizeSpeech(s.text);
      const clip = { step: s.step, audioUrl, text: s.text };
      clips.push(clip);
      onClip(clip);
    } catch (err) {
      console.error(`[narrate] step ${s.step} synthesis failed:`, err);
    }
  }
  return clips;
}

narrateRoutes.post("/blocks/:blockId/narrate", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");

  const rateLimit = await checkRateLimit(`narrate:${user.id}`, 15, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `Too many narration requests — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const block = await prisma.block.findFirst({
    where: { id: blockId, canvas: canvasAccessWhere(user) },
    include: { messages: { where: { role: "ASSISTANT" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!block) return c.json({ error: "Block not found" }, 404);
  if (!(await requireCanvasRole(user, block.canvasId, "editor"))) {
    return c.json({ error: "You don't have permission to generate narration on this canvas" }, 403);
  }

  let solution: SolutionStep[] | null | undefined;
  let table: TableForm | null | undefined;
  let scene: Scene | null = null;
  if (block.kind === "GRAPH") {
    if (!block.scene) return c.json({ error: "Block has no diagram to narrate" }, 400);
    scene = block.scene as unknown as Scene;
    const incoming = await prisma.connection.findFirst({
      where: { targetBlockId: blockId },
      include: {
        source: {
          include: { messages: { where: { role: "ASSISTANT" }, orderBy: { createdAt: "desc" }, take: 1 } },
        },
      },
    });
    solution = incoming?.source.messages[0]?.solution as SolutionStep[] | null | undefined;
  } else if (block.kind === "QUESTION" || block.kind === "SUB_QUESTION") {
    solution = block.messages[0]?.solution as SolutionStep[] | null | undefined;
    table = block.messages[0]?.table as TableForm | null | undefined;
    if ((!solution || solution.length === 0) && (!table || table.rows.length === 0)) {
      return c.json({ error: "Nothing to narrate for this answer" }, 400);
    }
  } else {
    return c.json({ error: "This block type can't be narrated" }, 400);
  }

  const script = buildNarrationScript(scene, solution, table);
  if (script.length === 0) {
    return c.json({ error: "Nothing to narrate for this diagram" }, 400);
  }

  const scriptHash = hashScript(script);
  const cached = block.narration as unknown as NarrationCache | null;
  const cacheHit = cached && cached.voice === TTS_VOICE && cached.scriptHash === scriptHash;

  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        if (cacheHit) {
          for (const clip of cached.clips) controller.enqueue(ndjson({ type: "clip", ...clip }));
          controller.enqueue(ndjson({ type: "done", narration: cached }));
          controller.close();
          return;
        }

        const lockKey = `${blockId}:${scriptHash}`;
        let clips: NarrationClip[];
        let isLeader = false;
        const existingLock = inFlightSynthesis.get(lockKey);
        if (existingLock) {
          clips = await existingLock;
          for (const clip of clips) controller.enqueue(ndjson({ type: "clip", ...clip }));
        } else {
          isLeader = true;
          const promise = synthesizeAll(script, (clip) => controller.enqueue(ndjson({ type: "clip", ...clip })));
          inFlightSynthesis.set(lockKey, promise);
          try {
            clips = await promise;
          } finally {
            inFlightSynthesis.delete(lockKey);
          }
        }

        if (isLeader && clips.length > 0) {
          const narration: NarrationCache = { voice: TTS_VOICE, scriptHash, clips };
          try {
            await prisma.$transaction([
              prisma.block.update({
                where: { id: blockId },
                data: { narration: narration as unknown as Prisma.InputJsonValue },
              }),
              prisma.activityEvent.create({
                data: {
                  userId: user.id,
                  blockId,
                  canvasId: block.canvasId,
                  type: "BLOCK_GENERATED",
                  metadata: {
                    modelId: TTS_MODEL_ID,
                    kind: "tts",
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    costUsd: null,
                    estimated: false,
                  },
                },
              }),
            ]);
          } catch (err) {
            console.error("[narrate] failed to persist narration cache:", err);
          }
          controller.enqueue(ndjson({ type: "done", narration }));
        } else if (clips.length > 0) {
          controller.enqueue(ndjson({ type: "done", narration: { voice: TTS_VOICE, scriptHash, clips } }));
        } else {
          controller.enqueue(ndjson({ type: "done", narration: null }));
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson" } }
  );
});
