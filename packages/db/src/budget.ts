import { prisma } from "./index";

/**
 * PRD "User System — Usage Metering & Notifications" §4.4: budgets/caps with graceful
 * degradation (warn → soft-limit → hard-stop), never a silent failure or surprise bill. No
 * per-user configurable UI yet (scoped down — this is the "make it correct" pass, not
 * monetization) — a single env-overridable default applies to every user, same as the existing
 * rate limiter's fixed thresholds.
 */
const DEFAULT_MONTHLY_BUDGET_USD = Number(process.env.AI_MONTHLY_BUDGET_USD ?? "2");
const WARN_THRESHOLD = 0.8;

export type BudgetStatus = "ok" | "warn" | "hard-stop";

export interface UserBudgetStatus {
  spentUsd: number;
  budgetUsd: number;
  remainingUsd: number;
  status: BudgetStatus;
  /** True once any event contributing to `spentUsd` was cost-estimated rather than exact — the
   * spend figure (and therefore the status) is a best-effort floor, same caveat already surfaced
   * on the Settings > Usage page. */
  estimated: boolean;
  periodStart: string;
  periodEnd: string;
}

function currentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Sums this calendar month's LLM cost for a user (TTS is excluded — its cost is always unknown,
 * see usageStats.ts's `anyUnknownCost`, so it can't meaningfully count against a dollar budget). */
export async function getUserBudgetStatus(userId: string): Promise<UserBudgetStatus> {
  const { start, end } = currentMonthRange();
  const events = await prisma.activityEvent.findMany({
    where: { userId, type: "BLOCK_GENERATED", createdAt: { gte: start, lt: end } },
    select: { metadata: true },
  });

  let spentUsd = 0;
  let estimated = false;
  for (const event of events) {
    const metadata = event.metadata as Record<string, unknown> | null;
    if (!metadata || metadata.kind === "tts") continue;
    const cost = typeof metadata.costUsd === "number" ? metadata.costUsd : 0;
    spentUsd += cost;
    if (metadata.estimated === true) estimated = true;
  }

  const budgetUsd = DEFAULT_MONTHLY_BUDGET_USD;
  const remainingUsd = Math.max(0, budgetUsd - spentUsd);
  const status: BudgetStatus = spentUsd >= budgetUsd ? "hard-stop" : spentUsd >= budgetUsd * WARN_THRESHOLD ? "warn" : "ok";

  return {
    spentUsd,
    budgetUsd,
    remainingUsd,
    status,
    estimated,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}
