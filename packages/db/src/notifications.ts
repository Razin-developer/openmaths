import { prisma } from "./index";

/**
 * Creates an in-app notification for a canvas-sharing event (PRD "Sharing, Collaboration &
 * Access Roles" §6). No email delivery is wired up (no SMTP/mail infra in this app yet) — per the
 * PRD's own fallback, an in-app notification is created regardless so the recipient discovers the
 * share via the bell/"Shared with me" surfaces even without email.
 */
export async function notifyCanvasShared(params: {
  userId: string;
  canvasId: string;
  canvasTitle: string;
  actorId?: string | null;
  actorName?: string | null;
  role: string;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: "CANVAS_SHARED",
      canvasId: params.canvasId,
      actorId: params.actorId ?? null,
      data: { canvasTitle: params.canvasTitle, role: params.role, actorName: params.actorName ?? null },
    },
  });
}

export async function notifyRoleChanged(params: {
  userId: string;
  canvasId: string;
  canvasTitle: string;
  actorId?: string | null;
  actorName?: string | null;
  role: string;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: "ROLE_CHANGED",
      canvasId: params.canvasId,
      actorId: params.actorId ?? null,
      data: { canvasTitle: params.canvasTitle, role: params.role, actorName: params.actorName ?? null },
    },
  });
}

export async function notifyCanvasUnshared(params: {
  userId: string;
  canvasId: string;
  canvasTitle: string;
  actorId?: string | null;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: "CANVAS_UNSHARED",
      canvasId: params.canvasId,
      actorId: params.actorId ?? null,
      data: { canvasTitle: params.canvasTitle },
    },
  });
}

/**
 * PRD "User System — Usage Metering & Notifications" §5.4/§4.4: fired once, at the moment a
 * generation pushes the user's monthly spend past the warn (80%) or hard-stop (100%) threshold —
 * the caller (messages/route.ts) is responsible for only calling this on the crossing, not on
 * every subsequent generation, so it doesn't spam.
 */
export async function notifyUsageCapWarning(params: { userId: string; percentUsed: number; hardStop: boolean }) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: "USAGE_CAP_WARNING",
      data: { percentUsed: params.percentUsed, hardStop: params.hardStop },
    },
  });
}

/**
 * PRD §5.4: "generation finished" for a long/backgrounded task, so a user who navigated away is
 * told their diagram/voice is ready. This app's generations are synchronous, streamed to an open
 * tab the user is watching — firing this on every completion would just spam a notification for
 * work the user already saw finish. Instead, messages/route.ts calls this ONLY when its own
 * `safeEnqueue` detected the client had actually disconnected (tab closed/navigated away) by the
 * time the generation — which keeps running server-side regardless of the client — finished; the
 * common case (user still watching) never fires it.
 */
export async function notifyGenerationFinished(params: {
  userId: string;
  canvasId: string;
  canvasTitle: string;
  blockTitle?: string | null;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: "GENERATION_FINISHED",
      canvasId: params.canvasId,
      data: { canvasTitle: params.canvasTitle, blockTitle: params.blockTitle ?? null },
    },
  });
}
