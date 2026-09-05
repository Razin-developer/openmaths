/** Best-effort conversion of common LaTeX constructs into words a TTS engine can speak sensibly.
 * Regex-based, not a full speech-rule engine (MathJax SRE is the "do it properly" option — noted
 * in the PRD as a future upgrade, out of scope here) — covers the constructs this app's own
 * scenes/solutions actually produce. */
/** Unicode math symbols (as opposed to backslash-LaTeX commands) the model sometimes writes
 * directly in plain prose — not just inside a `$...$` span. Kept separate from `latexToSpeech`'s
 * other substitutions (which only make sense inside math) so `toSpeechText` can also apply this
 * set to the whole answer, catching e.g. "x ≤ 5" typed outside any math delimiter. */
function speakLiteralSymbols(s: string): string {
  s = s.replace(/√/g, " square root of ");
  s = s.replace(/π/g, " pi ");
  s = s.replace(/°/g, " degrees ");
  s = s.replace(/≤/g, " less than or equal to ");
  s = s.replace(/≥/g, " greater than or equal to ");
  s = s.replace(/≠/g, " not equal to ");
  s = s.replace(/²/g, " squared ");
  s = s.replace(/³/g, " cubed ");
  return s;
}

function latexToSpeech(latex: string): string {
  let s = latex;
  // Structural commands that wrap other content — unwrap before the generic `\command` strip below
  // would otherwise eat them and leave stray braces/percent signs behind.
  s = s.replace(/\\begin\{[^}]*\}/g, " ");
  s = s.replace(/\\end\{[^}]*\}/g, " ");
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\sqrt\{([^}]+)\}/g, "square root of $1");
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");
  s = s.replace(/\^\{?(-?[a-zA-Z0-9]+)\}?/g, " to the power of $1 ");
  s = s.replace(/_\{?([^}\s]+)\}?/g, " sub $1 ");
  s = s.replace(/\\times/g, " times ");
  s = s.replace(/\\cdot/g, " times ");
  s = s.replace(/\\pi/g, " pi ");
  s = s.replace(/\\div/g, " divided by ");
  s = s.replace(/\\pm/g, " plus or minus ");
  s = s.replace(/\\le(q)?/g, " less than or equal to ");
  s = s.replace(/\\ge(q)?/g, " greater than or equal to ");
  s = s.replace(/\\neq/g, " not equal to ");
  s = s.replace(/\\approx/g, " approximately equal to ");
  s = speakLiteralSymbols(s);
  s = s.replace(/=/g, " equals ");
  s = s.replace(/\+/g, " plus ");
  s = s.replace(/(?<=[\d\s)}])-(?=[\d\s({])/g, " minus ");
  s = s.replace(/\//g, " divided by ");
  s = s.replace(/\\[a-zA-Z]+/g, " ");
  s = s.replace(/[{}%&]/g, "");
  return s;
}

import type { Scene } from "./dsl/types";
import type { SolutionStep, TableForm } from "./ai/envelope";

export interface NarrationStep {
  step: number;
  text: string;
}

/** One line per row, "header is cell, header is cell, ..." — reads a table out loud the way a
 * teacher would talk through it row by row, rather than a flat dump of every cell. The caption
 * (if present) becomes an intro line so a listener knows what the table is even about before the
 * rows start. */
function buildTableScript(table: TableForm): NarrationStep[] {
  const rowLines = table.rows.map((row, i) => {
    const cells = row
      .map((cell, j) => `${table.headers[j] ?? `column ${j + 1}`} is ${cell}`)
      .join(", ");
    return { step: i, text: cells };
  });
  if (!table.caption) return rowLines;
  // The caption becomes step 0, shifting every row down by one — keeps a single 0-indexed,
  // sequential script exactly like the solution/scene branches (see the indexing note below).
  return [{ step: 0, text: table.caption }, ...rowLines.map((r) => ({ step: r.step + 1, text: r.text }))];
}

/**
 * Builds the narration script for a block's voice-over (PRD §7.2): prefer the structured
 * `solution[]` (one clip per reasoning step, claim+detail+reason joined) since that's the actual,
 * checked explanation — this is also what makes a non-GRAPH (solution_steps-only) block
 * narratable at all, no scene required. Next, a `table` form narrates row by row. Falls back to
 * the scene's own step_start title/description + write_note text when neither is available (a
 * diagram-only GRAPH block). Pure/isomorphic — safe to call from the server (the /narrate route)
 * or the client.
 */
export function buildNarrationScript(
  scene: Scene | null | undefined,
  solution?: SolutionStep[] | null,
  table?: TableForm | null
): NarrationStep[] {
  const script = buildNarrationScriptRaw(scene, solution, table);
  // Every consumer of this script — the server /narrate route synthesizing real TTS clips, and
  // any client path — must never hear raw LaTeX/markdown ("dollar dollar", "hash", "asterisk
  // asterisk"). Normalizing here, once, at the source is what makes that a guarantee rather than
  // something each callsite has to remember to do (PRD "Explainer Quality, Streaming Stability &
  // Bug Sweep" §5). hashScript() is always called on this already-normalized output, so the cache
  // key matches the spoken text.
  return script.map((s) => ({ step: s.step, text: toSpeechText(s.text) })).filter((s) => s.text.length > 0);
}

function buildNarrationScriptRaw(
  scene: Scene | null | undefined,
  solution?: SolutionStep[] | null,
  table?: TableForm | null
): NarrationStep[] {
  if (solution && solution.length > 0) {
    // Prefer claim + reason — the explanation — over the LaTeX-dense `detail`, so the voice says
    // "the area of triangle BGC is 24" rather than reading a fraction character by character.
    // `detail` stays on screen (rendered as KaTeX), just not spoken.
    return solution
      .map((s, i) => ({ step: i, text: [s.claim, s.reason].filter(Boolean).join(". ") }))
      .filter((s) => s.text.length > 0);
  }
  if (table && table.rows.length > 0) {
    return buildTableScript(table).filter((s) => s.text.length > 0);
  }
  if (!scene) return [];

  // Indexed by playback POSITION (0, 1, 2, ...), not the raw scene `step` number — that's what
  // lets the player join a clip to the current step via `useSceneTimeline`'s `currentStepPosition`
  // regardless of which branch produced the script (solution steps are naturally 0-indexed too).
  const sceneSteps = Array.from(new Set(scene.ops.map((op) => op.step))).sort((a, b) => a - b);
  return sceneSteps
    .map((sceneStep, i) => {
      const marker = scene.ops.find((op) => op.step === sceneStep && op.op === "step_start");
      const notes = scene.ops.filter((op) => op.step === sceneStep && op.op === "write_note");
      const parts = [
        marker && marker.op === "step_start" ? marker.title : undefined,
        marker && marker.op === "step_start" ? marker.description : undefined,
        ...notes.flatMap((n) => (n.op === "write_note" ? [n.text, n.reason] : [])),
      ].filter((p): p is string => !!p);
      return { step: i, text: parts.join(". ") };
    })
    .filter((s) => s.text.length > 0);
}

/** Cheap deterministic hash of a narration script, used to detect when `Block.narration`'s cached
 * clips are stale (scene/solution changed since they were synthesized) without re-running TTS on
 * every fullscreen open. Not cryptographic — collision-safety isn't a concern for a cache key. */
export function hashScript(steps: NarrationStep[]): string {
  const str = steps.map((s) => `${s.step}:${s.text}`).join("\n");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/** Strips Markdown/LaTeX syntax down to plain, speakable text for the browser's speechSynthesis API. */
export function toSpeechText(markdown: string): string {
  let text = markdown;
  text = text.replace(/```[\s\S]*?```/g, " code block ");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner: string) => ` ${latexToSpeech(inner)} `);
  text = text.replace(/\$([^$\n]+)\$/g, (_m, inner: string) => ` ${latexToSpeech(inner)} `);
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/^>\s+/gm, "");
  text = text.replace(/^[-*+]\s+/gm, "");
  text = text.replace(/^\d+\.\s+/gm, "");
  // Catches a literal Unicode math symbol typed outside any $...$ span (the $-wrapped
  // replacements above already ran latexToSpeech, which includes this same substitution, on
  // everything inside math delimiters — this is only for text the model left unwrapped).
  text = speakLiteralSymbols(text);
  text = text.replace(/\s+/g, " ").trim();
  return text;
}
