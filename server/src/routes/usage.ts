import { Hono } from "hono";
import { prisma } from "@openmaths/db";
import { getUserBudgetStatus } from "@openmaths/db/budget";
import { getCanvasUsageStats, getUserUsageStats } from "@openmaths/db/usageStats";
import { getUserFunnelStats } from "@openmaths/db/funnelStats";
import { requireAuth } from "../middleware/auth";

export const usageRoutes = new Hono();

/** Feeds the live in-session usage meter (PRD "User System — Usage Metering & Notifications"
 * §4.4) — the current user's own monthly spend/remaining/status, nothing canvas-scoped. */
usageRoutes.get("/usage/budget", requireAuth, async (c) => {
  const user = c.get("user");
  const budget = await getUserBudgetStatus(user.id);
  return c.json({ budget });
});

/** Owner-only, same as the share-management routes — a collaborator can use a canvas but not see
 * what it's costing (PRD "User System — Usage Metering & Notifications" §4.1/§4.2). */
usageRoutes.get("/canvases/:canvasId/usage", requireAuth, async (c) => {
  const canvasId = c.req.param("canvasId");
  const user = c.get("user");

  const canvas = await prisma.canvas.findFirst({ where: { id: canvasId, userId: user.id } });
  if (!canvas) return c.json({ error: "Canvas not found" }, 404);

  const stats = await getCanvasUsageStats(canvasId);
  return c.json({ stats });
});

/** Settings > Usage — the current user's all-time usage breakdown by model (PRD "User System —
 * Usage Metering & Notifications"). */
usageRoutes.get("/usage/stats", requireAuth, async (c) => {
  const user = c.get("user");
  const stats = await getUserUsageStats(user.id);
  return c.json({ stats });
});

/** Settings > Insights — the learning-funnel telemetry (form-kind mix, verification-correction
 * rate, step-completion/replay, video-export split) — PRD v2 §9. */
usageRoutes.get("/insights", requireAuth, async (c) => {
  const user = c.get("user");
  const stats = await getUserFunnelStats(user.id);
  return c.json({ stats });
});
