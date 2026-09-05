import { describe, it, expect } from "vitest";
import { parseEnvelope, parseAnswerOnlyEnvelope, parseDiagramOnlyEnvelope } from "@/lib/ai/envelope";

const MIN_SCENE = {
  version: 1,
  ops: [{ id: "p1", step: 0, op: "draw_point", at: [0, 0] }],
};

describe("parseEnvelope", () => {
  it("parses a well-formed envelope with no diagram", () => {
    const raw = JSON.stringify({ answerMarkdown: "The answer is 4.", needsGraph: false });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.answerMarkdown).toBe("The answer is 4.");
      expect(result.envelope.needsGraph).toBe(false);
    }
  });

  it("requires answerMarkdown to be non-empty", () => {
    const raw = JSON.stringify({ answerMarkdown: "" });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(false);
  });

  it("rejects needsGraph:true with no scene (the refine)", () => {
    const raw = JSON.stringify({ answerMarkdown: "Here is a triangle.", needsGraph: true });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/scene is required/);
  });

  it("accepts needsGraph:true with a valid scene", () => {
    const raw = JSON.stringify({ answerMarkdown: "Here is a triangle.", needsGraph: true, scene: MIN_SCENE });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(true);
  });

  it("defaults needsGraph to false when omitted entirely", () => {
    const raw = JSON.stringify({ answerMarkdown: "3x = 9, so x = 3." });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.envelope.needsGraph).toBe(false);
  });

  it("strips a ```json fenced code block wrapper", () => {
    const raw = "```json\n" + JSON.stringify({ answerMarkdown: "Fenced." }) + "\n```";
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.envelope.answerMarkdown).toBe("Fenced.");
  });

  it("strips a bare ``` fence with no language tag", () => {
    const raw = "```\n" + JSON.stringify({ answerMarkdown: "Bare fence." }) + "\n```";
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(true);
  });

  it("drops top-level explicit-null keys instead of failing validation", () => {
    const raw = JSON.stringify({ answerMarkdown: "No diagram here.", scene: null, table: null });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(true);
  });

  it("repairs a stray unescaped newline inside a JSON string value", () => {
    // A literal newline inside the answerMarkdown string, as if the model pasted a multi-line
    // $$...$$ block verbatim instead of writing \\n — this is exactly the failure mode the
    // sanitizer exists for.
    const raw = '{"answerMarkdown": "Line one\nLine two"}';
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.envelope.answerMarkdown).toBe("Line one\nLine two");
  });

  it("rejects genuinely malformed JSON even after repair attempts", () => {
    const result = parseEnvelope("{ this is not json at all");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/);
  });

  it("caps solution at 12 steps", () => {
    const solution = Array.from({ length: 13 }, (_, i) => ({ claim: `step ${i}` }));
    const raw = JSON.stringify({ answerMarkdown: "Too many steps.", solution });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(false);
  });

  it("accepts exactly 12 solution steps", () => {
    const solution = Array.from({ length: 12 }, (_, i) => ({ claim: `step ${i}` }));
    const raw = JSON.stringify({ answerMarkdown: "Twelve steps.", solution });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(true);
  });
});

describe("parseAnswerOnlyEnvelope (stage 1)", () => {
  it("accepts needsGraph:true WITHOUT a scene — stage 1 never carries one", () => {
    const raw = JSON.stringify({ answerMarkdown: "A triangle problem.", needsGraph: true, diagramTitle: "Triangle proof" });
    const result = parseAnswerOnlyEnvelope(raw);
    expect(result.ok).toBe(true);
  });

  it("still rejects an empty answerMarkdown", () => {
    const raw = JSON.stringify({ answerMarkdown: "" });
    const result = parseAnswerOnlyEnvelope(raw);
    expect(result.ok).toBe(false);
  });
});

describe("forms[] (PRD v2 §5 Form architecture)", () => {
  it("parseEnvelope accepts a full forms[] answer with a scene on each geometry/plot entry", () => {
    const raw = JSON.stringify({
      answerMarkdown: "Two triangles compared.",
      forms: [
        { kind: "prose", markdown: "Here are two right triangles." },
        { kind: "geometry", title: "Triangle A", scene: MIN_SCENE },
        { kind: "geometry", title: "Triangle B", scene: MIN_SCENE },
        { kind: "table", headers: ["Triangle", "Hypotenuse"], rows: [["A", "5"], ["B", "13"]] },
      ],
    });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.envelope.forms).toHaveLength(4);
  });

  it("parseEnvelope rejects a geometry form missing its required scene", () => {
    const raw = JSON.stringify({
      answerMarkdown: "Broken.",
      forms: [{ kind: "geometry", title: "No scene" }],
    });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(false);
  });

  it("needsGraph:true with no scene is still satisfied by forms being present (the relaxed refine)", () => {
    const raw = JSON.stringify({
      answerMarkdown: "Using forms instead of the flat scene field.",
      needsGraph: true,
      forms: [{ kind: "geometry", title: "Only diagram", scene: MIN_SCENE }],
    });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(true);
  });

  it("caps forms at 6 entries", () => {
    const forms = Array.from({ length: 7 }, (_, i) => ({ kind: "prose", markdown: `Part ${i}` }));
    const raw = JSON.stringify({ answerMarkdown: "Too many forms.", forms });
    const result = parseEnvelope(raw);
    expect(result.ok).toBe(false);
  });

  it("parseAnswerOnlyEnvelope accepts stage 1's scene-less geometry/plot forms", () => {
    const raw = JSON.stringify({
      answerMarkdown: "Two triangles, diagrams drawn later.",
      forms: [
        { kind: "geometry", title: "Triangle A" },
        { kind: "plot", title: "Triangle B" },
      ],
    });
    const result = parseAnswerOnlyEnvelope(raw);
    expect(result.ok).toBe(true);
  });

  it("parseAnswerOnlyEnvelope strips a scene if a geometry form mistakenly carries one — stage 1's shape has no scene slot to keep it in", () => {
    // AnswerOnlyFormSchema's geometry/plot variants have no `scene` field at all — zod's default
    // "unknown keys are stripped" behavior (not rejected) means a stray scene here is silently
    // dropped rather than failing the whole parse, same forgiving behavior as every other
    // unexpected key elsewhere in this schema.
    const raw = JSON.stringify({
      answerMarkdown: "Stage 1 shouldn't send a scene.",
      forms: [{ kind: "geometry", title: "Too early", scene: MIN_SCENE }],
    });
    const result = parseAnswerOnlyEnvelope(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const form = result.envelope.forms?.[0];
      expect(form && "scene" in form).toBe(false);
    }
  });
});

describe("parseDiagramOnlyEnvelope (stage 2)", () => {
  it("accepts a bare scene with nothing else", () => {
    const raw = JSON.stringify({ scene: MIN_SCENE });
    const result = parseDiagramOnlyEnvelope(raw);
    expect(result.ok).toBe(true);
  });

  it("rejects a missing scene", () => {
    const result = parseDiagramOnlyEnvelope(JSON.stringify({}));
    expect(result.ok).toBe(false);
  });

  it("rejects a scene with zero ops", () => {
    const raw = JSON.stringify({ scene: { version: 1, ops: [] } });
    const result = parseDiagramOnlyEnvelope(raw);
    expect(result.ok).toBe(false);
  });
});
