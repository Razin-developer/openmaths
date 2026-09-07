export interface GcdLcmResult {
  gcd: number;
  lcm: number;
}

function gcdOf(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** Both inputs must be positive integers; the caller validates that before calling. */
export function computeGcdLcm(a: number, b: number): GcdLcmResult {
  const g = gcdOf(a, b);
  const lcm = g === 0 ? 0 : Math.abs(a * b) / g;
  return { gcd: g, lcm };
}
