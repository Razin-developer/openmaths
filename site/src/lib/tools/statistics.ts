export interface StatisticsResult {
  mean: number;
  median: number;
  mode: number[];
  range: number;
  count: number;
}

/** Parses a comma/whitespace-separated list of numbers, ignoring empty tokens. */
export function parseNumberList(input: string): number[] {
  return input
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

export function computeStatistics(values: number[]): StatisticsResult | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  // Every value appearing exactly once (maxCount === 1) has no meaningful mode, not "all of them".
  const mode = maxCount === 1 ? [] : [...counts.entries()].filter(([, c]) => c === maxCount).map(([v]) => v).sort((a, b) => a - b);

  const range = sorted[sorted.length - 1] - sorted[0];

  return { mean, median, mode, range, count: values.length };
}
