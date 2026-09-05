import { HackAI } from "@razinmohammedpt/hackai-sdk";
import { env } from "../../env";

// Mirrors app's src/lib/ai/client.ts (PRD "Split into app + server" — the AI SDK singleton itself
// stays duplicated per-process rather than shared via a package for now: `app` still owns the
// full generation pipeline, this copy backs the routes already ported — /models, /skills/generate).
export const hackAi = new HackAI({ apiKey: env.HACKCLUB_AI_API_KEY });

// Kept in sync by hand with app's src/lib/ai/client.ts — see that file's own doc comment for the
// model-choice rationale (this is just the id, not the reasoning, so duplication risk is low).
export const DEFAULT_MODEL_ID = "deepseek/deepseek-v4-flash-0731";

/** Always used for image/PDF attachment requests (see routes/messages.ts) — a current, stable,
 * non-preview Flash-class Gemini model, confirmed via a live spike to accept `image_url` content
 * parts through the normal chat-completions path (no separate Vision API). Not user-selectable. */
export const IMAGE_FILE_MODEL_ID = "google/gemini-3.5-flash";
