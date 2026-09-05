export interface RightTriangleResult {
  legA: number;
  legB: number;
  hypotenuse: number;
  area: number;
  perimeter: number;
}

/** Given any two of {legA, legB, hypotenuse}, solves the right triangle via the Pythagorean
 * theorem. Returns null when the inputs can't form a valid triangle (e.g. hypotenuse <= a leg). */
export function solveRightTriangle(input: { legA?: number; legB?: number; hypotenuse?: number }): RightTriangleResult | null {
  let { legA, legB, hypotenuse } = input;

  if (legA !== undefined && legB !== undefined && hypotenuse === undefined) {
    hypotenuse = Math.sqrt(legA * legA + legB * legB);
  } else if (legA !== undefined && hypotenuse !== undefined && legB === undefined) {
    if (hypotenuse <= legA) return null;
    legB = Math.sqrt(hypotenuse * hypotenuse - legA * legA);
  } else if (legB !== undefined && hypotenuse !== undefined && legA === undefined) {
    if (hypotenuse <= legB) return null;
    legA = Math.sqrt(hypotenuse * hypotenuse - legB * legB);
  }

  if (legA === undefined || legB === undefined || hypotenuse === undefined) return null;
  if (legA <= 0 || legB <= 0 || hypotenuse <= 0) return null;

  return {
    legA,
    legB,
    hypotenuse,
    area: (legA * legB) / 2,
    perimeter: legA + legB + hypotenuse,
  };
}
