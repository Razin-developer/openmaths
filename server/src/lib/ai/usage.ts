import { computeCost, type UsageLike } from "@razinmohammedpt/hackai-sdk";
import { hackAi } from "./client";

/** A single billed generation's usage/cost, recorded once per actual API call made (including
 * failed attempts that get retried — those still cost real tokens even though their output is
 * discarded). */
export interface GenerationUsageRecord {
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** USD, when resolvable from the SDK's live pricing lookup. */
  costUsd: number | null;
  /** True when promptTokens/completionTokens/costUsd are a rough char-count estimate rather than
   * real usage from the API — happens when the backend doesn't return a usage block on a
   * streaming response (see generate.ts's stream_options handling). */
  estimated: boolean;
}

/** Resolves a real dollar cost for a billed call from its usage block, via the SDK's live pricing
 * lookup — shared by every callsite that bills real tokens. Never throws: a pricing-lookup
 * failure just leaves costUsd null rather than breaking the caller. */
export async function recordUsage(modelId: string, usage: UsageLike | undefined, estimated: boolean): Promise<GenerationUsageRecord> {
  const promptTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;
  let costUsd: number | null = null;
  try {
    const pricing = await hackAi.models.getPricing(modelId);
    const cost = computeCost(pricing, usage);
    if (cost) costUsd = cost.totalCost;
  } catch {
    // Pricing lookup is best-effort — never let it break the caller.
  }
  return { modelId, promptTokens, completionTokens, totalTokens, costUsd, estimated };
}

export function sumUsage(records: GenerationUsageRecord[]): {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number | null;
  anyEstimated: boolean;
} {
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let totalCostUsd: number | null = 0;
  let anyEstimated = false;
  for (const r of records) {
    totalPromptTokens += r.promptTokens;
    totalCompletionTokens += r.completionTokens;
    totalTokens += r.totalTokens;
    if (r.estimated) anyEstimated = true;
    if (r.costUsd === null) totalCostUsd = null;
    else if (totalCostUsd !== null) totalCostUsd += r.costUsd;
  }
  return { totalPromptTokens, totalCompletionTokens, totalTokens, totalCostUsd, anyEstimated };
}
