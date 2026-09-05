export interface QuadraticResult {
  discriminant: number;
  roots: [number, number] | [number] | null;
  isComplex: boolean;
  complexRoots?: [{ re: number; im: number }, { re: number; im: number }];
  vertex: { x: number; y: number };
}

/** Solves ax² + bx + c = 0. Returns null for `a === 0` (not actually quadratic) — the caller
 * should validate `a !== 0` before showing a result, same as it validates any other input. */
export function solveQuadratic(a: number, b: number, c: number): QuadraticResult | null {
  if (a === 0) return null;

  const discriminant = b * b - 4 * a * c;
  const vertexX = -b / (2 * a);
  const vertex = { x: vertexX, y: a * vertexX * vertexX + b * vertexX + c };

  if (discriminant > 0) {
    const sqrtD = Math.sqrt(discriminant);
    const r1 = (-b + sqrtD) / (2 * a);
    const r2 = (-b - sqrtD) / (2 * a);
    return { discriminant, roots: [r1, r2], isComplex: false, vertex };
  }
  if (discriminant === 0) {
    return { discriminant, roots: [-b / (2 * a)], isComplex: false, vertex };
  }

  const sqrtAbsD = Math.sqrt(-discriminant);
  return {
    discriminant,
    roots: null,
    isComplex: true,
    complexRoots: [
      { re: -b / (2 * a), im: sqrtAbsD / (2 * a) },
      { re: -b / (2 * a), im: -sqrtAbsD / (2 * a) },
    ],
    vertex,
  };
}
