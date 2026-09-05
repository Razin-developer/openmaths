import { Hono } from "hono";
import { prisma } from "@openmaths/db";
import { canvasAccessWhere, resolveCanvasRole } from "@openmaths/db/canvasAccess";
import { requireAuth } from "../middleware/auth";

// Ported verbatim from app's src/app/api/canvases/{route.ts,[canvasId]/route.ts} (PRD "Split into
// app + server" — P1 shipped the GET reads; POST/PATCH/DELETE joined in P3-continued round 3).
export const canvasRoutes = new Hono();

canvasRoutes.get("/canvases", requireAuth, async (c) => {
  const user = c.get("user");
  const [canvases, unreadGroups] = await Promise.all([
    prisma.canvas.findMany({
      where: canvasAccessWhere(user),
      orderBy: { updatedAt: "desc" },
      include: {
        blocks: { select: { id: true, kind: true, positionX: true, positionY: true } },
        user: { select: { displayName: true, email: true } },
        collaborators: user.email ? { where: { email: user.email } } : false,
      },
    }),
    prisma.notification.groupBy({
      by: ["canvasId"],
      where: { userId: user.id, readAt: null, canvasId: { not: null } },
      _count: true,
    }),
  ]);
  const unreadByCanvas = new Map(unreadGroups.map((g) => [g.canvasId, g._count]));
  return c.json({
    canvases: canvases.map((cv) => {
      const isOwner = cv.userId === user.id;
      const collaborator = Array.isArray(cv.collaborators) ? cv.collaborators[0] : undefined;
      return {
        ...cv,
        isOwner,
        role: isOwner ? "owner" : (collaborator?.role.toLowerCase() ?? null),
        sharedBy: isOwner ? null : (cv.user.displayName ?? cv.user.email),
        unreadCount: unreadByCanvas.get(cv.id) ?? 0,
      };
    }),
  });
});

canvasRoutes.post("/canvases", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Untitled canvas";

  const canvas = await prisma.canvas.create({ data: { userId: user.id, title } });

  await prisma.activityEvent.create({
    data: { userId: user.id, type: "CANVAS_CREATED", metadata: { canvasId: canvas.id } },
  });

  return c.json({ canvas }, 201);
});

// Ported verbatim from app's src/app/canvas/[canvasId]/page.tsx (PRD "Split into app + server"
// P3-continued) — this is the SSR page's actual data logic, not just the old simple GET: the
// `?share=` fallback (PRD "Auth & Security Audit" F7 — a share-link token no longer grants access
// as a side effect of a plain GET; the page/client shows a "Join canvas" confirmation instead,
// see JoinCanvasPrompt.tsx + `POST /api/canvases/:id/join`, still on `app`) and `role` in the
// response (the page needs it to gate the board's own UI, e.g. "viewer" hides edit affordances).
canvasRoutes.get("/canvases/:canvasId", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const share = c.req.query("share");
  const user = c.get("user");

  const canvas = await prisma.canvas.findFirst({
    where: { id: canvasId, ...canvasAccessWhere(user) },
    include: {
      blocks: { include: { messages: { orderBy: { createdAt: "asc" } } } },
      connections: true,
    },
  });

  if (!canvas && share) {
    const validLink = await prisma.canvasShareLink.findFirst({
      where: { canvasId, token: share, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: {
        role: true,
        canvas: { select: { title: true, user: { select: { displayName: true, email: true } } } },
      },
    });
    if (validLink) {
      return c.json({
        joinPrompt: {
          canvasId,
          token: share,
          canvasTitle: validLink.canvas.title,
          ownerName: validLink.canvas.user.displayName ?? validLink.canvas.user.email,
          role: validLink.role.toLowerCase(),
        },
      });
    }
  }

  if (!canvas) return c.json({ error: "Canvas not found" }, 404);

  const role = await resolveCanvasRole(user, canvas.id);

  await prisma.activityEvent.create({
    data: { userId: user.id, type: "CANVAS_OPENED", metadata: { canvasId: canvas.id } },
  });

  return c.json({ canvas, role: role ?? "viewer" });
});

canvasRoutes.patch("/canvases/:canvasId", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  const existing = await prisma.canvas.findFirst({ where: { id: canvasId, userId: user.id } });
  if (!existing) return c.json({ error: "Canvas not found" }, 404);

  const canvas = await prisma.canvas.update({
    where: { id: canvasId },
    data: { title: typeof body?.title === "string" ? body.title : undefined },
  });

  return c.json({ canvas });
});

canvasRoutes.delete("/canvases/:canvasId", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const user = c.get("user");

  const existing = await prisma.canvas.findFirst({ where: { id: canvasId, userId: user.id } });
  if (!existing) return c.json({ error: "Canvas not found" }, 404);

  await prisma.canvas.delete({ where: { id: canvasId } });
  return c.json({ ok: true });
});
