import { z } from "zod";
import { SceneSchema } from "../dsl/schema";

/** A single discrete reasoning step, independent of any diagram — "what we now know" (claim),
 * the working that got there (detail), and the "why?" a student would ask about it (reason). */
export const SolutionStepSchema = z.object({
  claim: z.string().min(1),
  detail: z.string().optional(),
  reason: z.string().optional(),
});
export type SolutionStep = z.infer<typeof SolutionStepSchema>;

/** A DOM/KaTeX table form (PRD v2 §5/§6) — for truth tables, sign charts, comparisons, systems
 * of equations, or any enumeration that's clearer as rows/columns than as prose. Cells are
 * strings so they can carry inline LaTeX ($...$), rendered verbatim — no coordinate/sampling
 * error surface, unlike a geometry scene, so this is strictly more accurate for tabular data. */
export const TableFormSchema = z.object({
  caption: z.string().max(120).optional(),
  headers: z.array(z.string()).min(1).max(8),
  rows: z.array(z.array(z.string())).min(1).max(20),
});
export type TableForm = z.infer<typeof TableFormSchema>;

/**
 * PRD v2 §5 — the Form architecture. An ordered ALTERNATIVE to the flat solution/table/scene
 * fields below, for the real minority of answers those fixed-position fields can't express: more
 * than one diagram, more than one table, or content in an order other than "steps, then table,
 * then diagram" (e.g. prose framing on both sides of a diagram, two diagrams compared side by
 * side). The flat fields stay the DEFAULT, primary path — cheaper to reason about for the common
 * single-form case and already covers it completely — `forms` is additive, never a replacement
 * requirement (§5.4 "nothing regresses"): a response with no `forms` renders exactly as it always
 * has, through the exact same flat-field code paths.
 *
 * `number_line` from the PRD's form-kind table is deliberately folded into `geometry` here rather
 * than kept as its own discriminant — both are just a `Scene`, rendered by the exact same
 * `BlockCanvas` engine, with no distinct rendering path to justify a separate kind.
 */
export const FormSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("prose"), markdown: z.string().min(1) }),
  z.object({ kind: z.literal("solution_steps"), steps: z.array(SolutionStepSchema).min(1).max(12) }),
  z.object({ kind: z.literal("geometry"), scene: SceneSchema, title: z.string().max(60).optional() }),
  z.object({ kind: z.literal("plot"), scene: SceneSchema, title: z.string().max(60).optional() }),
  z.object({
    kind: z.literal("table"),
    caption: z.string().max(120).optional(),
    headers: z.array(z.string()).min(1).max(8),
    rows: z.array(z.array(z.string())).min(1).max(20),
  }),
]);
export type Form = z.infer<typeof FormSchema>;

/** Stage 1's version of a `geometry`/`plot` form — no `scene` yet, exactly like the flat
 * `needsGraph`/`scene` split below: the model commits to wanting a diagram and names it, and the
 * actual drawing happens in a separate stage-2 pass (one `runDiagramAttempt` per such form) that
 * never has to re-decide whether a diagram is warranted, just draw the one(s) already asked for. */
export const AnswerOnlyFormSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("prose"), markdown: z.string().min(1) }),
  z.object({ kind: z.literal("solution_steps"), steps: z.array(SolutionStepSchema).min(1).max(12) }),
  z.object({ kind: z.literal("geometry"), title: z.string().max(60).optional() }),
  z.object({ kind: z.literal("plot"), title: z.string().max(60).optional() }),
  z.object({
    kind: z.literal("table"),
    caption: z.string().max(120).optional(),
    headers: z.array(z.string()).min(1).max(8),
    rows: z.array(z.array(z.string())).min(1).max(20),
  }),
]);
export type AnswerOnlyForm = z.infer<typeof AnswerOnlyFormSchema>;

// Base shape shared by the full envelope and stage 1's scene-less variant below — kept as a
// plain ZodObject (pre-refine) specifically so AnswerOnlyEnvelopeSchema can .omit() off of it;
// z.object(...).refine(...) returns a ZodEffects, which doesn't expose .omit().
const GenerationEnvelopeShape = z.object({
  answerMarkdown: z.string().min(1),
  title: z.string().max(60).optional(),
  // Both optional/backward-compatible: older persisted messages and any response that omits
  // them (e.g. a casual/note-writing reply that isn't really a multi-step solution) still parse
  // fine — the UI falls back to plain answerMarkdown rendering when solution is absent.
  solution: z.array(SolutionStepSchema).max(12).optional(),
  finalAnswer: z.string().max(200).optional(),
  // A DOM table form — additive alongside solution/scene, never a replacement for either. See
  // TableFormSchema above. Optional/back-compatible like solution.
  table: TableFormSchema.optional(),
  // Optional with a false default (PRD v2 §5.3's back-compat framing) rather than strictly
  // required: a model that just answered with solution/table and genuinely has no diagram
  // sometimes omits this boolean entirely instead of writing "needsGraph": false, especially on
  // a retry pass that isn't re-shown the full contract. Treating omission as false is strictly
  // more forgiving than rejecting the whole response over a missing flag whose only job is to
  // gate an optional field.
  needsGraph: z.boolean().optional().default(false),
  diagramTitle: z.string().max(60).optional(),
  scene: SceneSchema.optional(),
  // The Form-architecture alternative (see FormSchema's doc comment) — omitted for the
  // overwhelming majority of answers, which use the flat fields above instead.
  forms: z.array(FormSchema).max(6).optional(),
});

export const GenerationEnvelopeSchema = GenerationEnvelopeShape.refine(
  (data) => !data.needsGraph || data.forms !== undefined || data.scene !== undefined,
  { message: "scene is required when needsGraph is true (unless forms is used instead)", path: ["scene"] }
);

export type GenerationEnvelope = z.infer<typeof GenerationEnvelopeSchema>;

/**
 * Two-stage generation (token-cost fix — see prompt.ts's STAGE1_ENVELOPE_CONTRACT for the full
 * rationale): stage 1 answers the question and decides needsGraph/diagramTitle WITHOUT ever
 * being shown the ~7,400-token diagram-drawing reference, so the ~9,100-token fixed system-prompt
 * cost only applies to the (usually small) fraction of turns that end up actually drawing
 * something. Same shape as GenerationEnvelopeSchema minus "scene" and its refine — a stage-1
 * response is never expected to carry a scene.
 */
export const AnswerOnlyEnvelopeSchema = GenerationEnvelopeShape.omit({ scene: true, forms: true }).extend({
  // Overrides the base shape's `forms` (which allows a full scene on geometry/plot forms) with
  // the scene-less stage-1 variant — same reasoning as omitting `scene` above.
  forms: z.array(AnswerOnlyFormSchema).max(6).optional(),
});
export type AnswerOnlyEnvelope = z.infer<typeof AnswerOnlyEnvelopeSchema>;

/** Stage 2 — fired only when stage 1's needsGraph came back true. Asks for nothing but the scene
 * itself, with the already-decided answer given as context so the diagram stays consistent with
 * reasoning that's already fixed rather than re-deriving (and potentially diverging from) it. */
export const DiagramOnlyEnvelopeSchema = z.object({ scene: SceneSchema });
export type DiagramOnlyEnvelope = z.infer<typeof DiagramOnlyEnvelopeSchema>;

export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

/**
 * Model output sometimes has literal, unescaped newlines/tabs inside a JSON string value —
 * most often a multi-line "$$...$$" LaTeX block pasted verbatim into answerMarkdown — which
 * JSON.parse rejects as a "bad control character". Re-asking the model to fix it is unreliable
 * (it frequently reproduces the exact same broken output), so this walks the raw text tracking
 * whether each character sits inside a string literal (respecting backslash-escapes and quotes)
 * and escapes stray control characters found there. Only used as a fallback after a plain parse
 * fails, so it never changes behavior for already-well-formed JSON.
 */
function sanitizeJsonControlChars(input: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of input) {
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === "\\") {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else if (ch === "\n") {
        out += "\\n";
      } else if (ch === "\r") {
        out += "\\r";
      } else if (ch === "\t") {
        out += "\\t";
      } else {
        out += ch;
      }
      continue;
    }
    if (ch === '"') inString = true;
    out += ch;
  }
  return out;
}

/**
 * Models frequently emit an explicit `null` for a field they mean to skip (e.g. `"scene": null`)
 * instead of just omitting the key — every optional field in this schema is `.optional()`
 * (accepts `undefined`), not `.nullable()`, so a literal `null` fails validation even though the
 * model's *intent* ("nothing here") was correctly communicated. Dropping top-level null-valued
 * keys before validation makes the parser robust to this near-universal LLM JSON quirk without
 * having to make every field nullable (which would just push the same ambiguity into the app
 * code that reads them).
 */
function dropNullKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(dropNullKeys);
  if (obj === null || typeof obj !== "object") return obj;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== null) out[key] = dropNullKeys(value);
  }
  return out;
}

/**
 * Strips markdown code fences (```json ... ``` or bare ```) the model may wrap its JSON in
 * despite instructions, repairs stray control characters inside string literals, drops
 * explicit-null keys (an LLM's way of saying "omitted"), and validates against whichever schema
 * the caller passes — shared by the full envelope, the stage-1 answer-only envelope, and the
 * stage-2 diagram-only envelope, all three of which just constrain a differently-shaped JSON
 * object out of the same kind of raw model output.
 */
function parseJsonEnvelope<T>(
  raw: string,
  schema: z.ZodType<T>
): { ok: true; envelope: T } | { ok: false; error: string } {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (firstErr) {
    try {
      parsed = JSON.parse(sanitizeJsonControlChars(stripped));
    } catch {
      return { ok: false, error: `Response was not valid JSON: ${(firstErr as Error).message}` };
    }
  }
  parsed = dropNullKeys(parsed);

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `Response did not match the required schema: ${result.error.message}` };
  }

  return { ok: true, envelope: result.data };
}

export function parseEnvelope(raw: string): { ok: true; envelope: GenerationEnvelope } | { ok: false; error: string } {
  return parseJsonEnvelope(raw, GenerationEnvelopeSchema);
}

/** Stage 1 — the answer, decided without ever seeing the diagram-drawing reference. */
export function parseAnswerOnlyEnvelope(
  raw: string
): { ok: true; envelope: AnswerOnlyEnvelope } | { ok: false; error: string } {
  return parseJsonEnvelope(raw, AnswerOnlyEnvelopeSchema);
}

/** Stage 2 — the scene, asked for only when stage 1 said needsGraph:true. */
export function parseDiagramOnlyEnvelope(
  raw: string
): { ok: true; envelope: DiagramOnlyEnvelope } | { ok: false; error: string } {
  return parseJsonEnvelope(raw, DiagramOnlyEnvelopeSchema);
}
