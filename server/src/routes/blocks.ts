import { Hono } from "hono";
import { prisma } from "@openmaths/db";
import { canvasAccessWhere, requireCanvasRole, type AccessUser } from "@openmaths/db/canvasAccess";
import { hackAi, DEFAULT_MODEL_ID } from "../lib/ai/client";
import { requireAuth } from "../middleware/auth";

export const blockRoutes = new Hono();

async function assertAccessibleBlock(blockId: string, user: AccessUser) {
  return prisma.block.findFirst({
    where: { id: blockId, canvas: canvasAccessWhere(user) },
  });
}

/** PATCH/DELETE are mutations — require Editor+ (PRD §7). Returns null (→ 403) when the block is
 * visible but the role is below Editor; the caller already 404s separately when the block isn't
 * visible at all. */
async function assertEditableBlock(blockId: string, user: AccessUser) {
  const block = await assertAccessibleBlock(blockId, user);
  if (!block) return { block: null, forbidden: false };
  const role = await requireCanvasRole(user, block.canvasId, "editor");
  return { block, forbidden: !role };
}

blockRoutes.post("/blocks", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  const canvasId = typeof body?.canvasId === "string" ? body.canvasId : null;
  const parentBlockId = typeof body?.parentBlockId === "string" ? body.parentBlockId : null;
  const positionX = typeof body?.positionX === "number" ? body.positionX : 0;
  const positionY = typeof body?.positionY === "number" ? body.positionY : 0;
  const requestedKind = typeof body?.kind === "string" ? body.kind : null;

  if (!canvasId) {
    return c.json({ error: "canvasId is required" }, 400);
  }

  const canvas = await prisma.canvas.findFirst({ where: { id: canvasId, ...canvasAccessWhere(user) } });
  if (!canvas) return c.json({ error: "Canvas not found" }, 404);
  if (!(await requireCanvasRole(user, canvasId, "editor"))) {
    return c.json({ error: "You don't have permission to edit this canvas" }, 403);
  }

  const kind =
    requestedKind === "NOTE" || requestedKind === "LINK"
      ? requestedKind
      : parentBlockId
        ? "SUB_QUESTION"
        : "QUESTION";
  const url = kind === "LINK" && typeof body?.url === "string" ? body.url.trim() : "";

  const { block, connection } = await prisma.$transaction(async (tx) => {
    const created = await tx.block.create({
      data: {
        canvasId,
        parentBlockId,
        kind,
        prompt: url,
        positionX,
        positionY,
      },
    });

    const createdConnection = parentBlockId
      ? await tx.connection.create({
          data: { canvasId, sourceBlockId: parentBlockId, targetBlockId: created.id },
        })
      : null;

    return { block: created, connection: createdConnection };
  });

  await prisma.activityEvent.create({
    data: { userId: user.id, blockId: block.id, type: "BLOCK_CREATED" },
  });

  return c.json({ block, connection }, 201);
});

blockRoutes.get("/blocks/:blockId", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");

  const block = await prisma.block.findFirst({
    where: { id: blockId, canvas: canvasAccessWhere(user) },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!block) return c.json({ error: "Block not found" }, 404);
  return c.json({ block });
});

blockRoutes.patch("/blocks/:blockId", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  const { block: existing, forbidden } = await assertEditableBlock(blockId, user);
  if (!existing) return c.json({ error: "Block not found" }, 404);
  if (forbidden) return c.json({ error: "You don't have permission to edit this canvas" }, 403);

  const block = await prisma.block.update({
    where: { id: blockId },
    data: {
      positionX: typeof body?.positionX === "number" ? body.positionX : undefined,
      positionY: typeof body?.positionY === "number" ? body.positionY : undefined,
      title: typeof body?.title === "string" ? body.title : undefined,
      modelId: typeof body?.modelId === "string" ? body.modelId : undefined,
      reasoningEffort: typeof body?.reasoningEffort === "string" ? body.reasoningEffort : undefined,
      prompt:
        (existing.kind === "NOTE" || existing.kind === "LINK") && typeof body?.prompt === "string"
          ? body.prompt
          : undefined,
      tabs: existing.kind === "LINK" && Array.isArray(body?.tabs) ? body.tabs : undefined,
    },
  });

  return c.json({ block });
});

blockRoutes.delete("/blocks/:blockId", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");

  const { block: existing, forbidden } = await assertEditableBlock(blockId, user);
  if (!existing) return c.json({ error: "Block not found" }, 404);
  if (forbidden) return c.json({ error: "You don't have permission to edit this canvas" }, 403);

  await prisma.block.delete({ where: { id: blockId } });
  return c.json({ ok: true });
});

const ALLOWED_TRACK_TYPES = new Set(["BLOCK_EXPORTED_VIDEO", "STEP_COMPLETED"]);

blockRoutes.post("/blocks/:blockId/track", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const type = typeof body?.type === "string" ? body.type : null;

  if (!type || !ALLOWED_TRACK_TYPES.has(type)) {
    return c.json({ error: "Unknown or missing event type" }, 400);
  }

  const block = await prisma.block.findFirst({ where: { id: blockId, canvas: canvasAccessWhere(user) } });
  if (!block) return c.json({ error: "Block not found" }, 404);

  const metadata = typeof body?.metadata === "object" && body.metadata !== null ? body.metadata : {};

  await prisma.activityEvent.create({
    data: { userId: user.id, blockId, type: type as "BLOCK_EXPORTED_VIDEO" | "STEP_COMPLETED", metadata },
  });

  return c.json({ ok: true });
});

/**
 * Writes/edits note content directly from a prompt in the note's fullscreen editor. Unlike
 * /messages, this returns plain markdown to insert into the note body — not the Question-node
 * JSON envelope contract, since a note has no chat thread and its content IS the output.
 */
blockRoutes.post("/blocks/:blockId/write-note", requireAuth, async (c) => {
  const blockId = c.req.param("blockId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  const currentContent = typeof body?.currentContent === "string" ? body.currentContent : "";

  if (!instruction) {
    return c.json({ error: "instruction is required" }, 400);
  }

  const block = await prisma.block.findFirst({
    where: { id: blockId, kind: "NOTE", canvas: canvasAccessWhere(user) },
  });
  if (!block) return c.json({ error: "Note not found" }, 404);
  if (!(await requireCanvasRole(user, block.canvasId, "editor"))) {
    return c.json({ error: "You don't have permission to edit this canvas" }, 403);
  }

  const completion = await hackAi.chat.completions.create({
    model: user.defaultModelId ?? DEFAULT_MODEL_ID,
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "You help write and edit notes in a math-tutoring app's note editor. Respond with ONLY the markdown text to write — no commentary, no code fences, no preamble like \"Here's...\". Use $...$ for inline math and $$...$$ for block math (KaTeX) wherever the note involves equations or symbols; otherwise write plain prose.",
      },
      {
        role: "user",
        content: currentContent
          ? `Current note content:\n${currentContent}\n\nInstruction: ${instruction}`
          : instruction,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!text) {
    return c.json({ error: "The model returned nothing" }, 502);
  }

  return c.json({ text });
});
