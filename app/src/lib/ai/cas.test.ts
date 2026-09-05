import { describe, it, expect } from "vitest";
import { extractAnswerNumber, casEvaluate } from "@/lib/ai/cas";

// Focused unit tests for the two pure primitives underneath the correctness self-check
// (PRD v2 §7.4 / §9 "CAS checks") — verifyAnswer() itself makes a real AI call and isn't
// unit-testable without mocking that, but the deterministic comparison it relies on
// (extract-the-claimed-number, independently re-evaluate-the-expression) is exactly what
// decides whether a wrong answer gets caught, so it's what's worth pinning down here.

describe("extractAnswerNumber", () => {
  it("extracts the number from a units-suffixed answer", () => {
    expect(extractAnswerNumber("72 square units")).toBe(72);
  });

  it("extracts the number from an 'x = N' style answer, ignoring the variable name", () => {
    expect(extractAnswerNumber("x = 5")).toBe(5);
  });

  it("takes the LAST number when multiple appear, not the first", () => {
    // e.g. "BG = 8, so the area is 24" — the actual result is 24, not the given 8.
    expect(extractAnswerNumber("BG = 8, so the area is 24")).toBe(24);
  });

  it("handles a negative number", () => {
    expect(extractAnswerNumber("x = -3")).toBe(-3);
  });

  it("handles a decimal number", () => {
    expect(extractAnswerNumber("Approximately 3.14")).toBe(3.14);
  });

  it("returns null when the text has no number at all", () => {
    expect(extractAnswerNumber("undefined")).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(extractAnswerNumber(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractAnswerNumber("")).toBeNull();
  });
});

describe("casEvaluate", () => {
  it("evaluates a plain arithmetic expression", () => {
    expect(casEvaluate("3 * 24")).toBe(72);
  });

  it("evaluates the exact north-star-test expression (centroid area problem)", () => {
    expect(casEvaluate("(1/2) * 6 * 8 * 3")).toBe(72);
  });

  it("returns null (never throws) for an expression containing a bare variable", () => {
    expect(casEvaluate("x + 1")).toBeNull();
  });

  it("returns null (never throws) for genuinely malformed input", () => {
    expect(casEvaluate("not math at all")).toBeNull();
    expect(casEvaluate("")).toBeNull();
  });

  it("returns null for a non-numeric result (mathjs can return matrices/units/etc.)", () => {
    expect(casEvaluate("[1, 2, 3]")).toBeNull();
  });
});
