import { describe, it, expect } from "vitest";
import { toSpeechText, buildNarrationScript, hashScript } from "@/lib/board/speech";
import type { SolutionStep, TableForm } from "@/lib/ai/envelope";

describe("toSpeechText", () => {
  it("never leaves a bare $ or $$ delimiter in the output", () => {
    const out = toSpeechText("The area is $\\pi r^2$ square units.");
    expect(out).not.toContain("$");
  });

  it("speaks a fraction as '... over ...'", () => {
    expect(toSpeechText("$\\frac{1}{2}$")).toContain("1 over 2");
  });

  it("speaks a square root", () => {
    expect(toSpeechText("$\\sqrt{16}$")).toContain("square root of 16");
  });

  it("speaks an exponent as 'to the power of'", () => {
    expect(toSpeechText("$x^2$")).toContain("to the power of 2");
  });

  it("strips markdown bold/italic markers without dropping the text", () => {
    expect(toSpeechText("This is **important** and *also this*.")).toBe("This is important and also this.");
  });

  it("strips a fenced code block down to a spoken placeholder", () => {
    expect(toSpeechText("```js\nconst x = 1;\n```")).toContain("code block");
  });

  it("strips markdown links down to their visible text", () => {
    expect(toSpeechText("See [this proof](https://example.com).")).toBe("See this proof.");
  });

  it("strips heading markers", () => {
    expect(toSpeechText("# Step 1\nDo the thing.")).toBe("Step 1 Do the thing.");
  });

  it("speaks common literal math symbols the model sometimes writes directly (not via LaTeX)", () => {
    expect(toSpeechText("x ≤ 5 and y ≥ 2, x ≠ y")).toContain("less than or equal to");
    expect(toSpeechText("x ≤ 5 and y ≥ 2, x ≠ y")).toContain("greater than or equal to");
    expect(toSpeechText("x ≤ 5 and y ≥ 2, x ≠ y")).toContain("not equal to");
  });

  it("collapses runs of whitespace left behind by substitutions", () => {
    const out = toSpeechText("A   B\n\nC");
    expect(out).not.toMatch(/\s{2,}/);
  });
});

describe("buildNarrationScript", () => {
  it("prefers structured solution steps over the scene, speaking claim + reason (not detail)", () => {
    const solution: SolutionStep[] = [
      { claim: "The triangle is right-angled.", detail: "$3^2+4^2=5^2$", reason: "Pythagorean converse." },
    ];
    const script = buildNarrationScript(null, solution, null);
    expect(script).toHaveLength(1);
    expect(script[0].text).toContain("right-angled");
    expect(script[0].text).toContain("Pythagorean converse");
    // detail (the LaTeX) is deliberately never spoken
    expect(script[0].text).not.toMatch(/3.*4.*5/);
  });

  it("skips a solution step whose claim+reason are both empty", () => {
    const solution: SolutionStep[] = [{ claim: "" }];
    expect(buildNarrationScript(null, solution, null)).toHaveLength(0);
  });

  it("falls back to a table, narrated row by row with the caption first", () => {
    const table: TableForm = {
      caption: "Truth table for P and Q",
      headers: ["P", "Q", "P and Q"],
      rows: [
        ["T", "T", "T"],
        ["T", "F", "F"],
      ],
    };
    const script = buildNarrationScript(null, null, table);
    expect(script[0].text).toContain("Truth table for P and Q");
    expect(script[1].text).toContain("P is T");
    expect(script.length).toBe(3); // caption + 2 rows
  });

  it("falls back to the scene's step_start/write_note text when no solution or table exists", () => {
    const scene = {
      version: 1 as const,
      ops: [
        { id: "s0", step: 0, op: "step_start" as const, title: "Draw the triangle" },
        { id: "n0", step: 0, op: "write_note" as const, text: "Mark the right angle." },
      ],
    };
    const script = buildNarrationScript(scene, null, null);
    expect(script).toHaveLength(1);
    expect(script[0].text).toContain("Draw the triangle");
    expect(script[0].text).toContain("Mark the right angle");
  });

  it("returns an empty script when there is genuinely nothing to narrate", () => {
    expect(buildNarrationScript(null, null, null)).toHaveLength(0);
  });

  it("output text never contains raw LaTeX delimiters (normalized via toSpeechText)", () => {
    const solution: SolutionStep[] = [{ claim: "The area is $\\pi r^2$.", reason: undefined }];
    const script = buildNarrationScript(null, solution, null);
    expect(script[0].text).not.toContain("$");
  });
});

describe("hashScript", () => {
  it("is deterministic for the same input", () => {
    const script = [{ step: 0, text: "Hello" }];
    expect(hashScript(script)).toBe(hashScript(script));
  });

  it("changes when the text changes", () => {
    const a = hashScript([{ step: 0, text: "Hello" }]);
    const b = hashScript([{ step: 0, text: "Goodbye" }]);
    expect(a).not.toBe(b);
  });

  it("changes when step numbers change even if text is identical", () => {
    const a = hashScript([{ step: 0, text: "Same" }]);
    const b = hashScript([{ step: 1, text: "Same" }]);
    expect(a).not.toBe(b);
  });
});
