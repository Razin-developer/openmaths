import { Hono } from "hono";
import { prisma } from "@openmaths/db";
import { canvasAccessWhere, requireCanvasRole } from "@openmaths/db/canvasAccess";
import { requireAuth } from "../middleware/auth";

// Ported verbatim from app's src/app/api/connections/{route.ts,[connectionId]/route.ts}
// (PRD "Split into app + server" P3-continued round 3).
export const connectionRoutes = new Hono();

connectionRoutes.post("/connections", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const { canvasId, sourceBlockId, targetBlockId, label } = body ?? {};

  if (typeof canvasId !== "string" || typeof sourceBlockId !== "string" || typeof targetBlockId !== "string") {
    return c.json({ error: "canvasId, sourceBlockId, targetBlockId are required" }, 400);
  }

  const canvas = await prisma.canvas.findFirst({ where: { id: canvasId, ...canvasAccessWhere(user) } });
  if (!canvas) return c.json({ error: "Canvas not found" }, 404);
  if (!(await requireCanvasRole(user, canvasId, "editor"))) {
    return c.json({ error: "You don't have permission to edit this canvas" }, 403);
  }

  const targetBlock = await prisma.block.findFirst({ where: { id: targetBlockId, canvasId } });
  if (!targetBlock) return c.json({ error: "Target block not found" }, 404);

  if (targetBlock.kind === "GRAPH") {
    const existing = await prisma.connection.findFirst({ where: { targetBlockId } });
    if (existing) return c.json({ error: "Graph nodes can only connect to one node" }, 400);
  }

  const connection = await prisma.connection.create({
    data: { canvasId, sourceBlockId, targetBlockId, label: typeof label === "string" ? label : null },
  });

  return c.json({ connection }, 201);
});

connectionRoutes.delete("/connections/:connectionId", requireAuth, async (c) => {
  const connectionId = c.req.param("connectionId");
  const user = c.get("user");

  const existing = await prisma.connection.findFirst({
    where: { id: connectionId, canvas: canvasAccessWhere(user) },
  });
  if (!existing) return c.json({ error: "Connection not found" }, 404);
  if (!(await requireCanvasRole(user, existing.canvasId, "editor"))) {
    return c.json({ error: "You don't have permission to edit this canvas" }, 403);
  }

  await prisma.connection.delete({ where: { id: connectionId } });
  return c.json({ ok: true });
});
