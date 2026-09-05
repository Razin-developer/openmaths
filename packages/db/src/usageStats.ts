import { prisma } from "./index";

export interface UsageEventRow {
  modelId: string;
  /** "llm" for chat completions (tokens + usually-known pricing), "stt" for voice-note
   * transcription (also a token-priced chat call — genuinely has a cost), "tts" for narration
   * synthesis (a Replicate prediction — no per-call pricing exists upstream at all, confirmed via
   * hackai-sdk v2's own `ReplicateRunResult.cost` contract, so these never have a cost figure). */
  kind: "llm" | "tts" | "stt";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  estimated: boolean;
  createdAt: Date;
}

export interface ModelUsageBreakdown {
  modelId: string;
  kind: "llm" | "tts" | "stt";
  requests: number;
  totalTokens: number;
  costUsd: number | null;
  estimated: boolean;
}

export interface UsageStats {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  /** Sum of every record that HAD a known cost — never nulled out by a record that didn't (see
   * `anyUnknownCost`), so one un-priced TTS call can't blank out the whole page's cost total. */
  totalCostUsd: number;
  /** True if any figure above blends in a char-count estimate (streaming responses where the
   * backend never returned real usage — see generate.ts) rather than being purely API-reported. */
  anyEstimated: boolean;
  /** True if at least one record (e.g. any TTS synthesis — Replicate has no per-call pricing API)
   * has no cost figure at all, meaning totalCostUsd is a floor, not the true total. */
  anyUnknownCost: boolean;
  byModel: ModelUsageBreakdown[];
  recent: UsageEventRow[];
}

const EMPTY_STATS: UsageStats = {
  totalRequests: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  totalCostUsd: 0,
  anyEstimated: false,
  anyUnknownCost: false,
  byModel: [],
  recent: [],
};

/**
 * Reads every recorded generation (one ActivityEvent per actual billed API call — see
 * messages/route.ts, which records one per attempt including discarded retries) and aggregates
 * it in JS. Metadata is a Json column, so Postgres/Prisma can't SUM its fields natively; for this
 * app's scale (a single educator's or small team's usage) fetching the full set and summing in
 * memory is simpler and fast enough — revisit with a real aggregation query only if this grows
 * into a genuinely high-volume, many-thousand-events-per-user product.
 */
export async function getUserUsageStats(userId: string): Promise<UsageStats> {
  const events = await prisma.activityEvent.findMany({
    where: { userId, type: "BLOCK_GENERATED" },
    orderBy: { createdAt: "desc" },
    select: { metadata: true, createdAt: true },
  });
  if (events.length === 0) return EMPTY_STATS;

  const rows: UsageEventRow[] = events
    .map((e) => {
      const m = e.metadata as Record<string, unknown> | null;
      if (!m || typeof m.modelId !== "string") return null;
      return {
        modelId: m.modelId,
        kind: m.kind === "tts" ? ("tts" as const) : m.kind === "stt" ? ("stt" as const) : ("llm" as const),
        promptTokens: typeof m.promptTokens === "number" ? m.promptTokens : 0,
        completionTokens: typeof m.completionTokens === "number" ? m.completionTokens : 0,
        totalTokens: typeof m.totalTokens === "number" ? m.totalTokens : 0,
        costUsd: typeof m.costUsd === "number" ? m.costUsd : null,
        estimated: m.estimated === true,
        createdAt: e.createdAt,
      };
    })
    .filter((r): r is UsageEventRow => r !== null);

  const byModelMap = new Map<string, ModelUsageBreakdown>();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let anyEstimated = false;
  let anyUnknownCost = false;

  for (const r of rows) {
    totalPromptTokens += r.promptTokens;
    totalCompletionTokens += r.completionTokens;
    totalTokens += r.totalTokens;
    if (r.estimated) anyEstimated = true;
    if (r.costUsd === null) anyUnknownCost = true;
    else totalCostUsd += r.costUsd;

    // Same model id used for both an LLM and TTS role (unlikely, but not impossible) gets
    // separate breakdown rows — a "$X across N requests" figure blending token-priced chat calls
    // with unpriced voice calls would be misleading either way.
    const key = `${r.kind}:${r.modelId}`;
    const existing = byModelMap.get(key);
    if (existing) {
      existing.requests += 1;
      existing.totalTokens += r.totalTokens;
      existing.estimated = existing.estimated || r.estimated;
      if (r.costUsd === null) existing.costUsd = existing.costUsd ?? null;
      else existing.costUsd = (existing.costUsd ?? 0) + r.costUsd;
    } else {
      byModelMap.set(key, {
        modelId: r.modelId,
        kind: r.kind,
        requests: 1,
        totalTokens: r.totalTokens,
        costUsd: r.costUsd,
        estimated: r.estimated,
      });
    }
  }

  return {
    totalRequests: rows.length,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    totalCostUsd,
    anyEstimated,
    anyUnknownCost,
    byModel: Array.from(byModelMap.values()).sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0)),
    recent: rows.slice(0, 25),
  };
}

export interface CanvasActorUsage {
  userId: string;
  displayName: string | null;
  email: string | null;
  requests: number;
  totalTokens: number;
  costUsd: number;
  anyEstimated: boolean;
  anyUnknownCost: boolean;
}

export interface CanvasUsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  anyEstimated: boolean;
  anyUnknownCost: boolean;
  byActor: CanvasActorUsage[];
}

const EMPTY_CANVAS_STATS: CanvasUsageStats = {
  totalRequests: 0,
  totalTokens: 0,
  totalCostUsd: 0,
  anyEstimated: false,
  anyUnknownCost: false,
  byActor: [],
};

/**
 * PRD "User System — Usage Metering & Notifications" §4.1: an owner sharing edit access wants to
 * know what it's costing them, broken down per collaborator. Caller is responsible for the
 * owner-only check (see the canvas usage route) — this function itself trusts `canvasId` and
 * does no access control. Same in-JS aggregation approach as `getUserUsageStats` — one canvas's
 * event volume is small enough that a real SQL rollup isn't worth the complexity yet.
 */
export async function getCanvasUsageStats(canvasId: string): Promise<CanvasUsageStats> {
  const events = await prisma.activityEvent.findMany({
    where: { canvasId, type: "BLOCK_GENERATED" },
    select: { userId: true, metadata: true },
  });
  if (events.length === 0) return EMPTY_CANVAS_STATS;

  const byActorMap = new Map<string, { requests: number; totalTokens: number; costUsd: number; anyEstimated: boolean; anyUnknownCost: boolean }>();
  let totalRequests = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let anyEstimated = false;
  let anyUnknownCost = false;

  for (const event of events) {
    const m = event.metadata as Record<string, unknown> | null;
    if (!m || typeof m.modelId !== "string") continue;
    const tokens = typeof m.totalTokens === "number" ? m.totalTokens : 0;
    const cost = typeof m.costUsd === "number" ? m.costUsd : null;
    const estimated = m.estimated === true;

    totalRequests += 1;
    totalTokens += tokens;
    if (estimated) anyEstimated = true;
    if (cost === null) anyUnknownCost = true;
    else totalCostUsd += cost;

    const existing = byActorMap.get(event.userId);
    if (existing) {
      existing.requests += 1;
      existing.totalTokens += tokens;
      existing.anyEstimated = existing.anyEstimated || estimated;
      if (cost === null) existing.anyUnknownCost = true;
      else existing.costUsd += cost;
    } else {
      byActorMap.set(event.userId, {
        requests: 1,
        totalTokens: tokens,
        costUsd: cost ?? 0,
        anyEstimated: estimated,
        anyUnknownCost: cost === null,
      });
    }
  }

  const actorIds = Array.from(byActorMap.keys());
  const users = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, displayName: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const byActor: CanvasActorUsage[] = actorIds
    .map((userId) => {
      const agg = byActorMap.get(userId)!;
      const u = userById.get(userId);
      return {
        userId,
        displayName: u?.displayName ?? null,
        email: u?.email ?? null,
        ...agg,
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);

  return { totalRequests, totalTokens, totalCostUsd, anyEstimated, anyUnknownCost, byActor };
}
