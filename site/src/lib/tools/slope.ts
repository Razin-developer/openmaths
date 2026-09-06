export interface SlopeResult {
  slope: number | null;
  yIntercept: number | null;
  equation: string;
}

/** Slope through two points; `slope: null` means a vertical line (undefined slope), not zero. */
export function slopeBetween(x1: number, y1: number, x2: number, y2: number): SlopeResult {
  if (x1 === x2) {
    return { slope: null, yIntercept: null, equation: `x = ${x1}` };
  }
  const slope = (y2 - y1) / (x2 - x1);
  const yIntercept = y1 - slope * x1;
  const sign = yIntercept >= 0 ? "+" : "-";
  const equation = `y = ${formatCoefficient(slope)}x ${sign} ${Math.abs(yIntercept).toFixed(2)}`;
  return { slope, yIntercept, equation };
}

function formatCoefficient(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
