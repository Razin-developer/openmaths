import { z } from "zod";
import { evaluate as mathjsEvaluate } from "mathjs";
import type { ChatMessage, PdfPlugin, UsageLike } from "@razinmohammedpt/hackai-sdk";
import { hackAi, DEFAULT_MODEL_ID } from "./client";
import { buildGenerationMessages, buildAnswerOnlyMessages, buildDiagramMessages, buildRetryMessages, type HistoryTurn } from "@openmaths/shared/ai/prompt";
import {
  parseEnvelope,
  parseAnswerOnlyEnvelope,
  parseDiagramOnlyEnvelope,
  GenerationError,
  SolutionStepSchema,
  type GenerationEnvelope,
  type AnswerOnlyEnvelope,
  type Form,
  type AnswerOnlyForm,
} from "@openmaths/shared/ai/envelope";
import type { MessageAttachment } from "@openmaths/shared/ai/attachments";
import { AnswerMarkdownExtractor } from "@openmaths/shared/ai/streamAnswerExtractor";
import { recordUsage, type GenerationUsageRecord } from "./usage";
import { sceneSteps } from "@openmaths/shared/dsl/types";

export type ReasoningEffort = "low" | "medium" | "high";

export interface GenerateAnswerParams {
  prompt: string;
  contextBlocks?: string;
  modelId?: string;
  reasoningEffort?: ReasoningEffort;
  attachments?: MessageAttachment[];
  history?: HistoryTurn[];
  personalization?: string;
  casual?: boolean;
  skillInstructions?: string;
  existingDiagrams?: string[];
}

// Constrains the model's output at the API/decoding level to syntactically valid JSON — not just
// asked for via prompt text (the ENVELOPE_CONTRACT below still does that too, for the *shape*).
// Before this, a meaningful fraction of generations failed parseEnvelope on the first attempt
// (usually a stray unescaped newline inside a LaTeX block) and silently cost a full second
// generation to fix via buildRetryMessages — double the tokens, and a visible "wrong answer
// flashes then gets replaced" moment for the user while streaming. Best-effort: providers that
// don't support this field just ignore it, exactly like reasoning_effort below.
const JSON_MODE = { response_format: { type: "json_object" as const } };

/** Rough fallback when the API genuinely never returns a usage block for a streaming response
 * (see streamAttempt) — ~4 chars/token is the standard order-of-magnitude estimate for English/
 * markdown/LaTeX text. Flagged `estimated: true` downstream so the usage dashboard can say so. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export interface GenerateAnswerResult {
  envelope: GenerationEnvelope;
  usage: GenerationUsageRecord[];
  /** Whether the self-check pass (verifyAnswer) actually patched the answer — telemetry signal
   * for how often the correctness net is catching something (PRD v2 §9). False for casual replies
   * and short answers, which skip verification entirely. */
  verificationCorrected: boolean;
}

// Correctness self-check (PRD "Real Step-by-Step Explanations" §6.5): a second, cheap,
// independent look at ONLY the finished final answer + steps, asked to re-derive/sanity-check
// rather than trust the first pass. Toggleable here in case it ever needs to come out quickly
// (latency spike, cost concern) without touching the call sites.
const VERIFY = true;
// Below this many steps a problem is usually simple enough that the first pass is reliable and
// a whole extra completion call isn't worth the latency/cost — this is exactly the "only verify
// when solution.length >= 3" heuristic the PRD calls for.
const VERIFY_MIN_STEPS = 3;

const VerifyResultSchema = z.object({
  ok: z.boolean(),
  correctedFinalAnswer: z.string().max(200).optional(),
  correctedSolution: z.array(SolutionStepSchema).max(12).optional(),
  note: z.string().optional(),
  // A plain numeric arithmetic expression (only numbers/operators/parens/sqrt — no variables,
  // no units) that evaluates to the same value as whatever final answer the checker considers
  // correct. Lets a DETERMINISTIC pass (mathjs, below) catch cases where the LLM checker itself
  // is fooled — PRD v2 §7.4/§9's "CAS" requirement — instead of trusting a second LLM opinion.
  checkExpression: z.string().max(300).optional(),
});

function buildVerifyMessages(prompt: string, envelope: GenerationEnvelope): ChatMessage[] {
  const steps = (envelope.solution ?? [])
    .map((s, i) => `${i + 1}. ${s.claim}${s.detail ? ` (${s.detail})` : ""}${s.reason ? ` — ${s.reason}` : ""}`)
    .join("\n");
  return [
    {
      role: "system",
      content:
        "You are an independent math checker. You will be given a problem, a proposed final " +
        "answer, and the step-by-step solution that produced it. Re-derive the answer YOURSELF " +
        "(a different way if possible — plug the result back into the problem, or work it a " +
        "different route) and compare. Respond with ONLY a JSON object, no prose, no code " +
        'fences: {"ok": true, "checkExpression": "..."} if the final answer and steps are correct, or ' +
        '{"ok": false, "correctedFinalAnswer": "...", "correctedSolution": [{"claim":"...","detail":"...","reason":"..."}, ...], "note": "one sentence on what was wrong", "checkExpression": "..."} ' +
        "if not. checkExpression is REQUIRED whenever the final answer is a plain number: a bare " +
        'arithmetic expression using only numbers/+-*/^()/sqrt (e.g. "10*72/5/2", never a ' +
        "variable or unit) that evaluates to the numeric value you believe is correct — this lets " +
        "your verdict be checked by a calculator, not just trusted. Omit it only when the answer " +
        "isn't a single number (e.g. an expression, a proof, a set of solutions). Only mark " +
        "ok:false when you are confident the original is actually wrong — don't nitpick phrasing " +
        "or omit a step that's merely less detailed than you'd write it.",
    },
    {
      role: "user",
      content: `Problem: ${prompt}\n\nProposed final answer: ${envelope.finalAnswer ?? "(none given)"}\n\nProposed steps:\n${steps}`,
    },
  ];
}

/** Best-effort extraction of "the number a student would read as the answer" from a short
 * finalAnswer string like "72 square units" or "x = 5" — takes the LAST numeric token, since
 * that's the actual result in both forms (a leading variable name isn't a number to compare). */
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

const CAS_RELATIVE_TOLERANCE = 1e-3;

/** Runs the self-check and returns a patched envelope if the check disagreed, plus whether it
 * actually corrected anything — surfaced up to the caller as `verificationCorrected` (PRD v2 §9
 * telemetry: "verification corrections" is one of the learning-funnel/cost signals to track).
 * Never throws; a failed/unparseable check just leaves the original envelope untouched (this is
 * a correctness safety net, not a required step — it must never be the reason a generation fails
 * outright). */
async function verifyAnswer(
  prompt: string,
  envelope: GenerationEnvelope,
  model: string,
  usage: GenerationUsageRecord[]
): Promise<{ envelope: GenerationEnvelope; corrected: boolean }> {
  if (!VERIFY) return { envelope, corrected: false };
  if (!envelope.solution || envelope.solution.length < VERIFY_MIN_STEPS) return { envelope, corrected: false };

  try {
    const response = await hackAi.chat.completions.create({
      model,
      messages: buildVerifyMessages(prompt, envelope),
      temperature: 0.1,
      ...JSON_MODE,
    });
    usage.push(await recordUsage(model, response.usage, false));
    const raw = response.choices[0]?.message?.content ?? "";
    const parsed = VerifyResultSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { envelope, corrected: false };

    // Deterministic layer: even when the LLM checker says ok:true, cross-check its own
    // checkExpression against the number it claims is correct via mathjs — catches the case
    // where the checker is *itself* fooled, which a second LLM opinion alone can't defend against.
    let casDisagrees = false;
    if (parsed.data.checkExpression) {
      const casValue = casEvaluate(parsed.data.checkExpression);
      const claimedAnswer = parsed.data.ok ? envelope.finalAnswer : (parsed.data.correctedFinalAnswer ?? envelope.finalAnswer);
      const claimedValue = extractAnswerNumber(claimedAnswer);
      if (casValue !== null && claimedValue !== null) {
        const tolerance = Math.max(1e-6, Math.abs(claimedValue) * CAS_RELATIVE_TOLERANCE);
        if (Math.abs(casValue - claimedValue) > tolerance) casDisagrees = true;
      }
    }

    if (parsed.data.ok && !casDisagrees) return { envelope, corrected: false };

    if (casDisagrees) {
      console.warn(
        "[verifyAnswer] CAS check disagreed with the claimed final answer:",
        parsed.data.checkExpression,
        "vs",
        parsed.data.ok ? envelope.finalAnswer : parsed.data.correctedFinalAnswer
      );
    }
    if (!parsed.data.ok) {
      console.warn("[verifyAnswer] corrected a self-check failure:", parsed.data.note ?? "(no note)");
    }
    // Only patch the visible answer when the checker actually supplied a correction — a CAS
    // disagreement with no replacement value is logged loudly but left alone, since overwriting
    // a correct-looking answer with nothing is worse than a flagged-but-unpatched one.
    if (!parsed.data.correctedFinalAnswer && !parsed.data.correctedSolution) return { envelope, corrected: false };

    return {
      envelope: {
        ...envelope,
        finalAnswer: parsed.data.correctedFinalAnswer ?? envelope.finalAnswer,
        solution: parsed.data.correctedSolution ?? envelope.solution,
      },
      corrected: true,
    };
  } catch (err) {
    console.error("[verifyAnswer] self-check call failed, keeping original answer:", err);
    return { envelope, corrected: false };
  }
}

/** Deterministic id in the same shape the model's own op ids use — good enough for a
 * synthesized op that only this process will ever read back. */
function synthId(): string {
  return `repair_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * PRD "Explainer Quality, Streaming Stability & Bug Sweep" §2: the prompt *asks* every step_start
 * to carry a description, but the model sometimes omits it — or, discovered via live testing once
 * generation was actually available, omits step_start entirely for some steps, which is the same
 * "Step N" with nothing telling the student why" symptom by a different route. Cheap,
 * deterministic repair instead of a second AI round-trip: align scene step i with solution[i]
 * (same index — both are emitted in solving order) and borrow that step's claim/reason. Falls
 * back to the first write_note at that step when there's no aligned solution. Never touches a
 * step_start that already has a description, and never fails the generation — a step that still
 * can't be repaired (no solution, no write_note either) is left as the player's own fallback
 * (GraphAnimationFullscreen) to handle.
 */
function repairSceneCaptions(envelope: GenerationEnvelope): GenerationEnvelope {
  const scene = envelope.scene;
  if (!scene) return envelope;

  const steps = sceneSteps(scene);
  let changed = false;

  function captionFor(step: number): { title?: string; description?: string } {
    const stepIndex = steps.indexOf(step);
    const solutionStep = stepIndex >= 0 ? envelope.solution?.[stepIndex] : undefined;
    if (solutionStep) {
      return {
        title: solutionStep.claim.length <= 40 ? solutionStep.claim : undefined,
        description: [solutionStep.claim, solutionStep.reason].filter(Boolean).join(". "),
      };
    }
    // `scene` is narrowed non-null above, but TS can't carry that through a nested closure.
    const note = scene!.ops.find((n) => n.op === "write_note" && n.step === step);
    if (note && note.op === "write_note") {
      return { description: [note.text, note.reason].filter(Boolean).join(". ") };
    }
    return {};
  }

  // Pass 1: fill in a description on any step_start that's missing one (existing behavior).
  let ops = scene.ops.map((op) => {
    if (op.op !== "step_start" || op.description) return op;
    const { description } = captionFor(op.step);
    if (!description) return op;
    changed = true;
    return { ...op, description };
  });

  // Pass 2: synthesize a whole step_start for any step that has ops but no step_start at all —
  // the case that slips past pass 1 entirely since there's no existing op to patch.
  const stepsWithMarker = new Set(ops.filter((op) => op.op === "step_start").map((op) => op.step));
  const stepsMissingMarker = steps.filter((s) => !stepsWithMarker.has(s));
  if (stepsMissingMarker.length > 0) {
    const missingSet = new Set(stepsMissingMarker);
    const seen = new Set<number>();
    const inserted: typeof ops = [];
    for (const op of ops) {
      if (missingSet.has(op.step) && !seen.has(op.step)) {
        seen.add(op.step);
        const { title, description } = captionFor(op.step);
        if (description) {
          changed = true;
          inserted.push({
            id: synthId(),
            op: "step_start",
            step: op.step,
            title: title ?? `Step ${steps.indexOf(op.step) + 1}`,
            description,
          });
        }
      }
      inserted.push(op);
    }
    ops = inserted;
  }

  if (!changed) return envelope;
  return { ...envelope, scene: { ...scene, ops } };
}

export async function generateAnswer({
  prompt,
  contextBlocks,
  modelId,
  reasoningEffort,
  attachments,
  history,
  personalization,
  casual,
  skillInstructions,
  existingDiagrams,
}: GenerateAnswerParams): Promise<GenerateAnswerResult> {
  const model = modelId || DEFAULT_MODEL_ID;
  const { messages, plugins } = buildGenerationMessages({
    prompt,
    contextBlocks,
    attachments,
    history,
    personalization,
    casual,
    skillInstructions,
    existingDiagrams,
  });

  // reasoning_effort is a best-effort passthrough — hackai-sdk has no typed/guaranteed support
  // for it, and models that don't recognize the field simply ignore it.
  const extra = reasoningEffort ? { reasoning_effort: reasoningEffort } : {};
  const usage: GenerationUsageRecord[] = [];

  const first = await hackAi.chat.completions.create({
    model,
    messages,
    plugins,
    temperature: 0.3,
    ...JSON_MODE,
    ...extra,
  });
  usage.push(await recordUsage(model, first.usage, false));
  const firstOutput = first.choices[0]?.message?.content ?? "";

  const firstResult = parseEnvelope(firstOutput);
  if (firstResult.ok) {
    const repaired = repairSceneCaptions(firstResult.envelope);
    const { envelope, corrected } = casual
      ? { envelope: repaired, corrected: false }
      : await verifyAnswer(prompt, repaired, model, usage);
    return { envelope, usage, verificationCorrected: corrected };
  }
  console.error("[generateAnswer] first attempt failed:", firstResult.error, "\nRAW:\n", firstOutput);

  const retryMessages = buildRetryMessages(messages, firstOutput, firstResult.error);
  const second = await hackAi.chat.completions.create({
    model,
    messages: retryMessages,
    plugins,
    temperature: 0.2,
    ...JSON_MODE,
    ...extra,
  });
  usage.push(await recordUsage(model, second.usage, false));
  const secondOutput = second.choices[0]?.message?.content ?? "";

  const secondResult = parseEnvelope(secondOutput);
  if (secondResult.ok) {
    const repaired = repairSceneCaptions(secondResult.envelope);
    const { envelope, corrected } = casual
      ? { envelope: repaired, corrected: false }
      : await verifyAnswer(prompt, repaired, model, usage);
    return { envelope, usage, verificationCorrected: corrected };
  }
  console.error("[generateAnswer] retry also failed:", secondResult.error, "\nRAW:\n", secondOutput);

  throw new GenerationError(
    `Model failed to produce a valid response after one retry: ${secondResult.error}`
  );
}

export type GenerateStreamEvent =
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "status"; phase: "diagram" };

async function* streamAttempt(
  messages: ChatMessage[],
  model: string,
  plugins: PdfPlugin[] | undefined,
  temperature: number,
  extra: Record<string, unknown>
): AsyncGenerator<GenerateStreamEvent, { raw: string; usage: GenerationUsageRecord }> {
  const stream = await hackAi.chat.completions.create({
    model,
    messages,
    plugins,
    temperature,
    stream: true,
    // Asks the backend to send a final chunk carrying token usage, same as OpenAI's
    // `stream_options.include_usage` — hackai-sdk's streaming types don't declare a `usage`
    // field on chunks (it's genuinely absent unless the backend opts in via this flag), so
    // whether we actually get one back is provider-dependent; handled defensively below.
    stream_options: { include_usage: true },
    ...JSON_MODE,
    ...extra,
  });
  const extractor = new AnswerMarkdownExtractor();
  let raw = "";
  let needsGraphSeen = false;
  let streamedUsage: UsageLike | undefined;
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      raw += delta;
      const newText = extractor.feed(delta);
      if (newText) yield { type: "delta", text: newText };
      // Detected as soon as the "needsGraph":true bytes stream in — well before the full JSON
      // object (including the scene) finishes, so the UI can show a diagram placeholder early
      // instead of waiting for the entire response to complete.
      if (!needsGraphSeen && /"needsGraph"\s*:\s*true/.test(raw)) {
        needsGraphSeen = true;
        yield { type: "status", phase: "diagram" };
      }
    }
    const maybeUsage = (chunk as unknown as { usage?: UsageLike }).usage;
    if (maybeUsage) streamedUsage = maybeUsage;
  }

  const usage = streamedUsage
    ? await recordUsage(model, streamedUsage, false)
    : await recordUsage(
        model,
        { prompt_tokens: estimateTokens(JSON.stringify(messages)), completion_tokens: estimateTokens(raw) },
        true
      );
  return { raw, usage };
}

/**
 * Stage 2 of two-stage generation — fired only when stage 1 said needsGraph:true. Non-streaming
 * (nothing in its output is user-facing prose to stream — it's pure scene JSON), one retry on
 * invalid JSON same as the rest of this file, and — unlike the answer stage — a failure here
 * degrades gracefully instead of throwing: the text answer stage 1 already produced is real and
 * valuable on its own, so losing the diagram is far better than losing the whole turn over it.
 */
export async function runDiagramAttempt(
  stage1: AnswerOnlyEnvelope,
  prompt: string,
  model: string
): Promise<{ scene: GenerationEnvelope["scene"]; usage: GenerationUsageRecord[] }> {
  const usage: GenerationUsageRecord[] = [];
  const messages = buildDiagramMessages({
    prompt,
    answerMarkdown: stage1.answerMarkdown,
    solution: stage1.solution,
    finalAnswer: stage1.finalAnswer,
    diagramTitle: stage1.diagramTitle,
  });

  async function attempt(msgs: ChatMessage[], temperature: number) {
    const response = await hackAi.chat.completions.create({ model, messages: msgs, temperature, ...JSON_MODE });
    usage.push(await recordUsage(model, response.usage, false));
    return response.choices[0]?.message?.content ?? "";
  }

  try {
    const firstOutput = await attempt(messages, 0.3);
    const firstResult = parseDiagramOnlyEnvelope(firstOutput);
    if (firstResult.ok) return { scene: firstResult.envelope.scene, usage };
    console.error("[runDiagramAttempt] first attempt failed:", firstResult.error, "\nRAW:\n", firstOutput);

    const retryMessages = buildRetryMessages(messages, firstOutput, firstResult.error);
    const secondOutput = await attempt(retryMessages, 0.2);
    const secondResult = parseDiagramOnlyEnvelope(secondOutput);
    if (secondResult.ok) return { scene: secondResult.envelope.scene, usage };
    console.error("[runDiagramAttempt] retry also failed:", secondResult.error, "\nRAW:\n", secondOutput);
  } catch (err) {
    console.error("[runDiagramAttempt] call failed:", err);
  }
  // Graceful degrade — see doc comment above. Caller treats an undefined scene as "no diagram
  // after all" and clears needsGraph accordingly rather than failing the whole generation.
  return { scene: undefined, usage };
}

/**
 * PRD v2 §5 — resolves stage 1's scene-less `forms[]` (any mix of prose/solution_steps/table
 * as-is, plus geometry/plot forms that only have a `title` so far) into the full `Form[]` the
 * final envelope carries, by calling `runDiagramAttempt` once per geometry/plot form — same
 * degrade-gracefully contract as the single-diagram path: a form whose diagram attempt comes back
 * empty is dropped rather than shipped scene-less (a `Form`'s geometry/plot variant requires a
 * scene), so a partial forms[] answer never renders a broken diagram card.
 */
async function resolveForms(
  forms: AnswerOnlyForm[] | undefined,
  stage1: AnswerOnlyEnvelope,
  prompt: string,
  model: string,
  usage: GenerationUsageRecord[]
): Promise<Form[] | undefined> {
  if (!forms || forms.length === 0) return undefined;

  const resolved: Form[] = [];
  for (const form of forms) {
    if (form.kind === "geometry" || form.kind === "plot") {
      const { scene, usage: diagramUsage } = await runDiagramAttempt(
        { ...stage1, diagramTitle: form.title },
        prompt,
        model
      );
      usage.push(...diagramUsage);
      if (scene) resolved.push({ kind: form.kind, scene, title: form.title });
      // else: drop this one form — the rest of forms[] still renders.
    } else {
      resolved.push(form);
    }
  }
  return resolved.length > 0 ? resolved : undefined;
}

/**
 * Two-stage generation. Stage 1 (streamed) answers the question and decides needsGraph/
 * diagramTitle using STAGE1_ENVELOPE_CONTRACT — no diagram-drawing reference in its prompt at
 * all, so the common no-diagram turn never pays for it. Stage 2 (non-streaming, DIAGRAM_ONLY_
 * CONTRACT + the DSL/olympiad reference) fires only when stage 1 actually said needsGraph:true,
 * given stage 1's already-decided answer as context so the diagram stays consistent with it. A
 * "reset" event marks the client's streamed buffer as stale — emitted whenever stage 1's own
 * output turns out to be invalid JSON and its retry starts fresh (stage 2 has no such event: it
 * streams nothing user-facing, so there's no buffer to reset).
 */
export async function* generateAnswerStream(
  params: GenerateAnswerParams
): AsyncGenerator<GenerateStreamEvent, GenerateAnswerResult> {
  const model = params.modelId || DEFAULT_MODEL_ID;
  const { messages, plugins } = buildAnswerOnlyMessages(params);
  const extra = params.reasoningEffort ? { reasoning_effort: params.reasoningEffort } : {};
  const usage: GenerationUsageRecord[] = [];

  async function* finish(stage1: AnswerOnlyEnvelope): AsyncGenerator<GenerateStreamEvent, GenerateAnswerResult> {
    let envelope: GenerationEnvelope = { ...stage1, scene: undefined, forms: undefined };
    if (stage1.needsGraph) {
      yield { type: "status", phase: "diagram" };
      const { scene, usage: diagramUsage } = await runDiagramAttempt(stage1, params.prompt, model);
      usage.push(...diagramUsage);
      // Degrade to "no diagram" rather than shipping needsGraph:true with no scene — the
      // [[DIAGRAM]] marker already streamed as part of answerMarkdown either way; NodeBody's
      // marker-stripping is content-based, not needsGraph-gated, so a dropped diagram just means
      // the marker vanishes from the rendered text same as it always does, no dangling artifact.
      envelope = scene
        ? { ...stage1, scene, forms: undefined }
        : { ...stage1, needsGraph: false, scene: undefined, forms: undefined };
    } else if (stage1.forms) {
      // The forms[] path (PRD v2 §5) — independent of needsGraph, which only ever governs the
      // flat single-scene field. A forms-based answer resolves any geometry/plot forms' diagrams
      // here, one runDiagramAttempt call per such form.
      yield { type: "status", phase: "diagram" };
      const forms = await resolveForms(stage1.forms, stage1, params.prompt, model, usage);
      envelope = { ...stage1, scene: undefined, forms };
    }
    const repaired = repairSceneCaptions(envelope);
    const { envelope: verified, corrected } = params.casual
      ? { envelope: repaired, corrected: false }
      : await verifyAnswer(params.prompt, repaired, model, usage);
    return { envelope: verified, usage, verificationCorrected: corrected };
  }

  const first = streamAttempt(messages, model, plugins, 0.3, extra);
  let step = await first.next();
  while (!step.done) {
    yield step.value;
    step = await first.next();
  }
  const { raw: firstOutput, usage: firstUsage } = step.value;
  usage.push(firstUsage);

  const firstResult = parseAnswerOnlyEnvelope(firstOutput);
  if (firstResult.ok) return yield* finish(firstResult.envelope);
  console.error("[generateAnswerStream] first attempt failed:", firstResult.error, "\nRAW:\n", firstOutput);

  yield { type: "reset" };
  const retryMessages = buildRetryMessages(messages, firstOutput, firstResult.error);
  const second = streamAttempt(retryMessages, model, plugins, 0.2, extra);
  let step2 = await second.next();
  while (!step2.done) {
    yield step2.value;
    step2 = await second.next();
  }
  const { raw: secondOutput, usage: secondUsage } = step2.value;
  usage.push(secondUsage);

  const secondResult = parseAnswerOnlyEnvelope(secondOutput);
  if (secondResult.ok) return yield* finish(secondResult.envelope);
  console.error("[generateAnswerStream] retry also failed:", secondResult.error, "\nRAW:\n", secondOutput);

  throw new GenerationError(
    `Model failed to produce a valid response after one retry: ${secondResult.error}`
  );
}
