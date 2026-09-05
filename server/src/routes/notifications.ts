import { Hono } from "hono";
import { prisma } from "@openmaths/db";
import { requireAuth } from "../middleware/auth";

// Ported verbatim from app's src/app/api/notifications/{route.ts,read/route.ts} (PRD "Split into
// app + server" P1 for the GET, P4 for POST /notifications/read).
export const notificationRoutes = new Hono();

notificationRoutes.get("/notifications", requireAuth, async (c) => {
  const user = c.get("user");
  const canvasId = c.req.query("canvasId") ?? null;

  const where = canvasId ? { userId: user.id, canvasId } : { userId: user.id };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);

  return c.json({ notifications, unreadCount });
});

/**
 * Marks notifications read/unread (PRD "User System — Usage Metering & Notifications" §5.3, the
 * Gmail-style hover toggle):
 * - `{ id, read: false }` → marks that one notification UNREAD (`readAt: null`).
 * - `{ id }` or `{ id, read: true }` → marks that one READ.
 * - no `id` → marks ALL of this user's unread notifications read (the explicit "Mark all read"
 *   button only).
 * Scoped to `userId: user.id` on every branch so a caller can't touch someone else's notifications.
 */
notificationRoutes.post("/notifications/read", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  const read = body?.read === false ? false : true;

  if (id) {
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: read ? new Date() : null },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return c.json({ ok: true });
});
