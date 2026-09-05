export interface Fraction {
  numerator: number;
  denominator: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

export function simplify(f: Fraction): Fraction {
  const divisor = gcd(f.numerator, f.denominator);
  const sign = f.denominator < 0 ? -1 : 1;
  return { numerator: (sign * f.numerator) / divisor, denominator: (sign * f.denominator) / divisor };
}

export type FractionOp = "add" | "subtract" | "multiply" | "divide";

/** Returns null for a division by a zero-numerator fraction, or either input fraction having a
 * zero denominator — both genuinely undefined, not just edge-case-ugly. */
export function computeFraction(a: Fraction, b: Fraction, op: FractionOp): Fraction | null {
  if (a.denominator === 0 || b.denominator === 0) return null;
  if (op === "divide" && b.numerator === 0) return null;

  let result: Fraction;
  switch (op) {
    case "add":
      result = { numerator: a.numerator * b.denominator + b.numerator * a.denominator, denominator: a.denominator * b.denominator };
      break;
    case "subtract":
      result = { numerator: a.numerator * b.denominator - b.numerator * a.denominator, denominator: a.denominator * b.denominator };
      break;
    case "multiply":
      result = { numerator: a.numerator * b.numerator, denominator: a.denominator * b.denominator };
      break;
    case "divide":
      result = { numerator: a.numerator * b.denominator, denominator: a.denominator * b.numerator };
      break;
  }
  return simplify(result);
}
