import { prisma } from "./index";

/**
 * PRD v2 §9 "Telemetry" — "measure the learning funnel (Zeigarnik completion, replay rate) and
 * cost." Cost already has its own page (Settings > Usage, see usageStats.ts); this is the
 * completion/replay half.
 */
export interface FunnelStats {
  totalGenerations: number;
  /** How many of those generations used each representation — which form the model reaches for
   * in practice, not just in the abstract (PRD's "form-kind chosen" signal). */
  byFormKind: { formKind: string; count: number }[];
  /** How often the self-check pass caught and corrected a wrong first answer — a direct quality
   * signal, not just a curiosity: a persistently high rate would mean the underlying model or
   * prompt needs attention, not that the safety net is "working great". */
  verificationCorrectedCount: number;
  verificationCorrectedRate: number | null;
  /** Zeigarnik completion — a walkthrough watched all the way to its last step, not scrubbed to
   * or abandoned partway. */
  stepCompletions: number;
  narratedStepCompletions: number;
  /** Video exports, split by whether narration was included — the PRD's own "video exported
   * (silent vs voiced)" signal, verbatim. */
  videoExports: number;
  voicedVideoExports: number;
}

const EMPTY_STATS: FunnelStats = {
  totalGenerations: 0,
  byFormKind: [],
  verificationCorrectedCount: 0,
  verificationCorrectedRate: null,
  stepCompletions: 0,
  narratedStepCompletions: 0,
  videoExports: 0,
  voicedVideoExports: 0,
};

/**
 * Reads every ActivityEvent this signal set is built from and aggregates in JS — same tradeoff
 * usageStats.ts already makes (metadata is a Json column Postgres can't natively SUM/GROUP BY
 * into), fine at this app's real scale.
 */
export async function getUserFunnelStats(userId: string): Promise<FunnelStats> {
  const events = await prisma.activityEvent.findMany({
    where: { userId, type: { in: ["BLOCK_GENERATED", "STEP_COMPLETED", "BLOCK_EXPORTED_VIDEO"] } },
    select: { type: true, metadata: true },
  });
  if (events.length === 0) return EMPTY_STATS;

  const formKindCounts = new Map<string, number>();
  let totalGenerations = 0;
  let verificationCorrectedCount = 0;
  let stepCompletions = 0;
  let narratedStepCompletions = 0;
  let videoExports = 0;
  let voicedVideoExports = 0;

  for (const e of events) {
    const m = (e.metadata as Record<string, unknown> | null) ?? {};
    if (e.type === "BLOCK_GENERATED") {
      totalGenerations++;
      const kind = typeof m.formKind === "string" ? m.formKind : "unknown";
      formKindCounts.set(kind, (formKindCounts.get(kind) ?? 0) + 1);
      if (m.verificationCorrected === true) verificationCorrectedCount++;
    } else if (e.type === "STEP_COMPLETED") {
      stepCompletions++;
      if (m.narrated === true) narratedStepCompletions++;
    } else if (e.type === "BLOCK_EXPORTED_VIDEO") {
      videoExports++;
      if (m.voiced === true) voicedVideoExports++;
    }
  }

  const byFormKind = [...formKindCounts.entries()]
    .map(([formKind, count]) => ({ formKind, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalGenerations,
    byFormKind,
    verificationCorrectedCount,
    verificationCorrectedRate: totalGenerations > 0 ? verificationCorrectedCount / totalGenerations : null,
    stepCompletions,
    narratedStepCompletions,
    videoExports,
    voicedVideoExports,
  };
}
