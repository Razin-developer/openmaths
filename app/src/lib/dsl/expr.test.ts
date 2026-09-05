import { describe, it, expect } from "vitest";
import { evaluateExpr, formatExprResult } from "@/lib/dsl/expr";

describe("evaluateExpr", () => {
  it("evaluates basic arithmetic with correct precedence", () => {
    expect(evaluateExpr("2 + 3 * 4", {})).toBe(14);
    expect(evaluateExpr("(2 + 3) * 4", {})).toBe(20);
  });

  it("handles unary minus", () => {
    expect(evaluateExpr("-5 + 3", {})).toBe(-2);
    expect(evaluateExpr("3 - -2", {})).toBe(5);
  });

  it("handles exponentiation, right-associative", () => {
    expect(evaluateExpr("2 ^ 3", {})).toBe(8);
    expect(evaluateExpr("2 ^ 3 ^ 2", {})).toBe(512); // 2^(3^2), not (2^3)^2
  });

  it("substitutes named variables", () => {
    expect(evaluateExpr("r * 2", { r: 5 })).toBe(10);
    expect(evaluateExpr("a + b", { a: 3, b: 4 })).toBe(7);
  });

  it("resolves pi (both spellings) and e as constants", () => {
    expect(evaluateExpr("pi", {})).toBeCloseTo(Math.PI, 10);
    expect(evaluateExpr("π", {})).toBeCloseTo(Math.PI, 10);
    expect(evaluateExpr("e", {})).toBeCloseTo(Math.E, 10);
  });

  it("calls known functions", () => {
    expect(evaluateExpr("sqrt(16)", {})).toBe(4);
    expect(evaluateExpr("abs(-7)", {})).toBe(7);
    expect(evaluateExpr("max(3, 9, 1)", {})).toBe(9);
    expect(evaluateExpr("round(2.6)", {})).toBe(3);
  });

  it("supports the real use case: area of a circle from a radius variable", () => {
    expect(evaluateExpr("pi * r ^ 2", { r: 3 })).toBeCloseTo(Math.PI * 9, 10);
  });

  it("throws on an unknown variable rather than silently returning NaN/0", () => {
    expect(() => evaluateExpr("q + 1", {})).toThrow(/Unknown variable/);
  });

  it("throws on an unknown function", () => {
    expect(() => evaluateExpr("frobnicate(1)", {})).toThrow(/Unknown function/);
  });

  it("throws on a genuinely malformed expression", () => {
    expect(() => evaluateExpr("2 + + 3", {})).toThrow();
    expect(() => evaluateExpr("(2 + 3", {})).toThrow();
  });

  it("throws on an unexpected character", () => {
    expect(() => evaluateExpr("2 & 3", {})).toThrow(/Unexpected character/);
  });
});

describe("formatExprResult", () => {
  it("prints an integer with no decimal point", () => {
    expect(formatExprResult(4)).toBe("4");
    expect(formatExprResult(-3)).toBe("-3");
  });

  it("caps at 2 decimal places", () => {
    expect(formatExprResult(1 / 3)).toBe("0.33");
  });

  it("trims a value that rounds to an integer", () => {
    expect(formatExprResult(3.001)).toBe("3");
  });

  it("returns a placeholder for non-finite values instead of 'NaN'/'Infinity'", () => {
    expect(formatExprResult(NaN)).toBe("?");
    expect(formatExprResult(Infinity)).toBe("?");
    expect(formatExprResult(-Infinity)).toBe("?");
  });
});
