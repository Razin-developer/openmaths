import { evaluate as mathjsEvaluate } from "mathjs";

/** Best-effort extraction of "the number a student would read as the answer" from a short
 * finalAnswer string like "72 square units" or "x = 5" — takes the LAST numeric token, since
 * that's the actual result in both forms (a leading variable name isn't a number to compare).
 *
 * PRD "Split into app + server" P4 — these two pure primitives are the only piece of the old
 * generation pipeline `app` still needs (the vitest suite pins them down); the rest of that
 * pipeline (`generateAnswerStream`, `verifyAnswer`, etc.) now lives only in `server`. */
export function extractAnswerNumber(text: string | undefined): number | null {
  if (!text) return null;
  const matches = text.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const n = Number(matches[matches.length - 1]);
  return Number.isFinite(n) ? n : null;
}

/** Deterministically evaluates a plain numeric expression via mathjs — never throws; a malformed
 * or variable-containing expression just yields null (skips the CAS check for that generation
 * rather than blocking it). */
export function casEvaluate(expression: string): number | null {
  try {
    const result = mathjsEvaluate(expression);
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
