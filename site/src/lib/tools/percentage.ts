/** "X% of Y" */
export function percentOf(percent: number, of: number): number {
  return (percent / 100) * of;
}

/** "X is what % of Y" */
export function whatPercent(x: number, of: number): number | null {
  if (of === 0) return null;
  return (x / of) * 100;
}

/** Percentage change from `from` to `to` — positive is an increase, negative a decrease. */
export function percentChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}
