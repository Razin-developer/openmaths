import { Hono } from "hono";
import { prisma } from "@openmaths/db";
import {
  notifyCanvasShared,
  notifyRoleChanged,
  notifyCanvasUnshared,
} from "@openmaths/db/notifications";
import { requireAuth } from "../middleware/auth";

export const sharingRoutes = new Hono();

const VALID_ROLES = new Set(["EDITOR", "COMMENTER", "VIEWER"]);
/** off | 24h | 7d | 30d, per PRD §5's expiry menu. */
const EXPIRY_MS: Record<string, number | null> = {
  off: null,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/** Only the owner can manage sharing — collaborators can use a canvas but not re-share it. */
async function assertOwnedCanvas(canvasId: string, userId: string) {
  return prisma.canvas.findFirst({ where: { id: canvasId, userId } });
}

sharingRoutes.get("/canvases/:canvasId/share", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const user = c.get("user");

  const canvas = await assertOwnedCanvas(canvasId, user.id);
  if (!canvas) return c.json({ error: "Canvas not found" }, 404);

  const [collaborators, shareLink] = await Promise.all([
    prisma.canvasCollaborator.findMany({ where: { canvasId }, orderBy: { createdAt: "asc" } }),
    prisma.canvasShareLink.findFirst({ where: { canvasId } }),
  ]);

  return c.json({ collaborators, shareLink });
});

sharingRoutes.post("/canvases/:canvasId/share", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const requestedRole = typeof body?.role === "string" ? body.role.toUpperCase() : "EDITOR";
  const role = VALID_ROLES.has(requestedRole) ? requestedRole : "EDITOR";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Enter a valid email address" }, 400);
  }

  const canvas = await assertOwnedCanvas(canvasId, user.id);
  if (!canvas) return c.json({ error: "Canvas not found" }, 404);

  if (email === user.email?.toLowerCase()) {
    return c.json({ error: "You already own this canvas" }, 400);
  }

  const invitee = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const status = invitee ? "ACTIVE" : "PENDING";

  const collaborator = await prisma.canvasCollaborator.upsert({
    where: { canvasId_email: { canvasId, email } },
    update: { role: role as "EDITOR" | "COMMENTER" | "VIEWER", status },
    create: { canvasId, email, role: role as "EDITOR" | "COMMENTER" | "VIEWER", status, invitedById: user.id },
  });

  if (invitee) {
    await notifyCanvasShared({
      userId: invitee.id,
      canvasId,
      canvasTitle: canvas.title,
      actorId: user.id,
      actorName: user.displayName ?? user.email,
      role: role.toLowerCase(),
    });
  }

  return c.json({ collaborator }, 201);
});

sharingRoutes.patch("/canvases/:canvasId/share/:collaboratorId", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const collaboratorId = c.req.param("collaboratorId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const requestedRole = typeof body?.role === "string" ? body.role.toUpperCase() : null;

  if (!requestedRole || !VALID_ROLES.has(requestedRole)) {
    return c.json({ error: "role must be EDITOR, COMMENTER, or VIEWER" }, 400);
  }

  const canvas = await prisma.canvas.findFirst({ where: { id: canvasId, userId: user.id } });
  if (!canvas) return c.json({ error: "Canvas not found" }, 404);

  const collaborator = await prisma.canvasCollaborator.findFirst({ where: { id: collaboratorId, canvasId } });
  if (!collaborator) return c.json({ error: "Collaborator not found" }, 404);

  const updated = await prisma.canvasCollaborator.update({
    where: { id: collaboratorId },
    data: { role: requestedRole as "EDITOR" | "COMMENTER" | "VIEWER" },
  });

  const invitee = await prisma.user.findUnique({ where: { email: collaborator.email }, select: { id: true } });
  if (invitee) {
    await notifyRoleChanged({
      userId: invitee.id,
      canvasId,
      canvasTitle: canvas.title,
      actorId: user.id,
      actorName: user.displayName ?? user.email,
      role: requestedRole.toLowerCase(),
    });
  }

  return c.json({ collaborator: updated });
});

sharingRoutes.delete("/canvases/:canvasId/share/:collaboratorId", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const collaboratorId = c.req.param("collaboratorId");
  const user = c.get("user");

  const canvas = await prisma.canvas.findFirst({ where: { id: canvasId, userId: user.id } });
  if (!canvas) return c.json({ error: "Canvas not found" }, 404);

  const collaborator = await prisma.canvasCollaborator.findFirst({ where: { id: collaboratorId, canvasId } });
  await prisma.canvasCollaborator.deleteMany({ where: { id: collaboratorId, canvasId } });

  if (collaborator) {
    const removedUser = await prisma.user.findUnique({ where: { email: collaborator.email }, select: { id: true } });
    if (removedUser) {
      await notifyCanvasUnshared({ userId: removedUser.id, canvasId, canvasTitle: canvas.title, actorId: user.id });
    }
  }

  return c.json({ ok: true });
});

sharingRoutes.post("/canvases/:canvasId/share-link", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const requestedRole = typeof body?.role === "string" ? body.role.toUpperCase() : "VIEWER";
  const role = VALID_ROLES.has(requestedRole) ? requestedRole : "VIEWER";
  const expiryKey = typeof body?.expiry === "string" ? body.expiry : "off";
  const expiresAt = EXPIRY_MS[expiryKey] != null ? new Date(Date.now() + EXPIRY_MS[expiryKey]!) : null;

  const canvas = await prisma.canvas.findFirst({ where: { id: canvasId, userId: user.id } });
  if (!canvas) return c.json({ error: "Canvas not found" }, 404);

  const existing = await prisma.canvasShareLink.findFirst({ where: { canvasId } });
  const shareLink = existing
    ? await prisma.canvasShareLink.update({
        where: { id: existing.id },
        data: { role: role as "EDITOR" | "COMMENTER" | "VIEWER", expiresAt },
      })
    : await prisma.canvasShareLink.create({
        data: { canvasId, role: role as "EDITOR" | "COMMENTER" | "VIEWER", expiresAt, createdById: user.id },
      });

  return c.json({ shareLink });
});

sharingRoutes.delete("/canvases/:canvasId/share-link", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const user = c.get("user");

  const canvas = await prisma.canvas.findFirst({ where: { id: canvasId, userId: user.id } });
  if (!canvas) return c.json({ error: "Canvas not found" }, 404);

  await prisma.canvasShareLink.deleteMany({ where: { canvasId } });
  return c.json({ ok: true });
});

/**
 * Redeems a share-link token as an explicit POST (PRD "Auth & Security Audit" F7) — ported
 * verbatim from app/src/app/api/canvases/[canvasId]/join/route.ts.
 */
sharingRoutes.post("/canvases/:canvasId/join", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token || !user.email) {
    return c.json({ error: "Missing token or account has no email" }, 400);
  }
  if (!user.emailVerified) {
    return c.json(
      { error: "Verify your email before joining a shared canvas — check your signup confirmation." },
      403
    );
  }

  const validLink = await prisma.canvasShareLink.findFirst({
    where: { canvasId, token, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  });
  if (!validLink) {
    return c.json({ error: "This link is invalid or has expired" }, 404);
  }

  const email = user.email.toLowerCase();
  const alreadyCollaborator = await prisma.canvasCollaborator.findUnique({
    where: { canvasId_email: { canvasId, email } },
  });
  await prisma.canvasCollaborator.upsert({
    where: { canvasId_email: { canvasId, email } },
    update: {},
    create: { canvasId, email, role: validLink.role, status: "ACTIVE" },
  });

  if (!alreadyCollaborator) {
    const ownerCanvas = await prisma.canvas.findUnique({
      where: { id: canvasId },
      select: { title: true, userId: true, user: { select: { displayName: true, email: true } } },
    });
    if (ownerCanvas) {
      await notifyCanvasShared({
        userId: user.id,
        canvasId,
        canvasTitle: ownerCanvas.title,
        actorId: ownerCanvas.userId,
        actorName: ownerCanvas.user.displayName ?? ownerCanvas.user.email ?? null,
        role: validLink.role.toLowerCase(),
      });
    }
  }

  return c.json({ ok: true });
});
