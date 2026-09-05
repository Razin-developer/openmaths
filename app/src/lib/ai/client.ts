import { HackAI } from "@razinmohammedpt/hackai-sdk";

declare global {
  var __hackAiClient: HackAI | undefined;
}

export const hackAi = globalThis.__hackAiClient ?? new HackAI({ apiKey: process.env.HACKCLUB_AI_API_KEY });

if (process.env.NODE_ENV !== "production") {
  globalThis.__hackAiClient = hackAi;
}

// PRD "Real Step-by-Step Explanations" §11 north-star test (the centroid-area problem) — live-
// tested this session: qwen/qwen3-32b reliably gets the final number right (via the self-check
// pass) but never produces the elegant named-theorem/ratio reasoning the AC specifies, reaching
// for messy coordinate geometry instead — a genuine model-capability gap, not a prompt-engineering
// one ("PREFER THE ELEGANT PATH" in prompt.ts made no difference on this model). deepseek/
// deepseek-v4-pro-0813 nailed the elegant 3-step reasoning on the same problem and was chosen as
// the first fix for this (2026-09-01), at roughly 12-14x qwen3-32b's per-token cost.
//
// Superseded the same day by a broader 25-model evaluation (see the published model-eval report)
// run against the same north-star problem: deepseek/deepseek-v4-flash-0731 — a flash-tier sibling
// of the model above, from the same provider — also produced the elegant right-angle + centroid-
// ratio reasoning, at roughly 1/60th of -pro-0813's per-call cost in that test ($0.00078 vs
// $0.089+). User-selected (2026-09-01): switched to the cheaper sibling since it clears the same
// correctness/elegance bar.
export const DEFAULT_MODEL_ID = "deepseek/deepseek-v4-flash-0731";

/** Always used for image/PDF attachment requests (see messages/route.ts) — a current, stable,
 * non-preview Flash-class Gemini model, confirmed via a live spike to accept `image_url` content
 * parts through the normal chat-completions path (no separate Vision API). Not user-selectable
 * (PRD "UI/UX Polish" §9.2 — attachments always route here, no per-block/per-user override). */
export const IMAGE_FILE_MODEL_ID = "google/gemini-3.5-flash";
