# openmaths — PRD: Real Step-by-Step Explanations + Voice-Narrated Video

| | |
|---|---|
| **Product** | openmaths — AI-drawn, step-by-step math canvas |
| **Author** | Razin (with Claude) |
| **Date** | 2026-08-20 |
| **Status** | Ready for implementation |
| **Audience** | Claude Code (implementing agent) working in this repo |
| **Repo** | Next.js 16 · React 19 · Prisma 7 / Postgres · `@xyflow/react` canvas · R3F (three.js) render engine · `@razinmohammedpt/hackai-sdk` for all AI |

> **How to use this doc:** This is the spec you hand to Claude Code. It is grounded in the *actual* current code (file paths and function names below are real). Read the "Current architecture" section first, then implement Feature 1 and Feature 2 in the phase order given. Every phase ends with acceptance criteria — do not mark a phase done until they pass. The north-star test at the end is the single problem the whole PRD must solve well.

---

## 1. TL;DR

openmaths already renders beautiful, progressively-animated math diagrams from an LLM-authored drawing DSL, with a per-step sidebar, a fullscreen player, and WebM video export. **But it is not yet a product a student would choose over ChatGPT or Photomath**, for two reasons:

1. **It over-indexes on the picture and under-delivers on the reasoning.** For problems whose *logic* — not their *shape* — is the hard part (the centroid problem in §3), the app forces a diagram, renders a shallow or *wrong* one, and the written explanation is thin. Competitors win on "granular steps with named rules."
2. **The voice is a toy.** Narration uses the browser's robotic `speechSynthesis`, and the exported video has **no audio track at all**. The closest direct competitor (Mathos AI) ships narrated 2–5 minute explanation videos.

This PRD defines two workstreams:

- **Feature 1 — A real step-by-step explanation engine** that stands on its own for *non-visualizable* problems: a structured, numbered, "why?"-expandable solution; honest diagram decisions; and a correctness self-check so we stop shipping wrong answers.
- **Feature 2 — Voice-narrated video** using `hackai-sdk` TTS only, with a **single fixed voice model and no model selection exposed to the user**: real TTS narration in the player, and an "Export video **with voiceover**" path that muxes a synced audio track into the WebM.

---

## 2. Goals & non-goals

**Goals**
- G1. For a reasoning-heavy problem with no natural figure, produce an explanation as good as or better than ChatGPT's: correct final answer, discrete steps, each step's *justification* available on demand.
- G2. Stop forcing (and stop shipping wrong) diagrams. `needsGraph` becomes honest; when a figure is genuinely secondary, the text carries the solution.
- G3. Add a correctness self-check pass so answers like the centroid problem come out **72, not 24**.
- G4. Replace robotic narration with real TTS via `hackai-sdk`, and let users **export the animation as a video with a synced voiceover**.
- G5. Keep TTS invisible-by-default: one server-chosen voice/model, **no model picker for TTS anywhere in the UI**.

**Non-goals**
- N1. No new LLM provider — everything stays on `hackai-sdk` (`hackAi.*`).
- N2. No user-facing choice of TTS voice/model (a single server constant; a future admin-only default is fine).
- N3. No real-time streaming TTS in v1 (pre-generate per step; realtime is a later option).
- N4. No change to auth, billing, or the canvas/board interaction model.
- N5. Not building generic subject coverage (physics/chem) — stay math-first.

---

## 3. Problem statement (with evidence)

A user asked openmaths:

> *In a triangle ABC, the medians from B and from C meet at the point G. Given BG = 8, CG = 6, BC = 10, find the area of triangle ABC.*

**What openmaths did:** rendered a right-triangle area diagram with `b = 8, h = 6` and printed `A = ½(8)(6) = 24` — i.e. it computed the area of △BGC and stopped. **No step text, wrong final answer, and a diagram that actively misleads.**

**What a good explainer does (the correct solution):**
1. G is the centroid, so it splits the medians `2:1`.
2. In △BGC the three sides are `BG = 8, CG = 6, BC = 10`, and `8² + 6² = 10²`, so △BGC is right-angled at G ⇒ `[BGC] = ½·8·6 = 24`.
3. The centroid splits the whole triangle so that `[BGC] = ⅓·[ABC]`, therefore **`[ABC] = 3 × 24 = 72`**.

The insight is *arithmetic and theorem-driven*, not spatial. A tiny figure helps, but the **reasoning is the answer**, and that is exactly what the app currently drops. (ChatGPT even self-corrects a "×6 vs ×3" slip when the student pushes back — openmaths must support that interrogation loop too; it already has per-node chat history, so this is about answer quality, not plumbing.)

This one problem is the **north-star acceptance test** (see §11).

---

## 4. Current architecture (grounding for the implementer)

The app is well-built. Do **not** rewrite these; extend them.

**AI generation pipeline**
- `src/lib/ai/client.ts` — the singleton `hackAi` client + `DEFAULT_MODEL_ID = "qwen/qwen3-32b"`.
- `src/lib/ai/prompt.ts` — the system prompt. Contains `ENVELOPE_CONTRACT` (the JSON the model must return), `DSL_REFERENCE`, and `OLYMPIAD_GEOMETRY_REFERENCE`. **This is where explanation quality is won or lost.**
- `src/lib/ai/envelope.ts` — `GenerationEnvelopeSchema` (Zod) + `parseEnvelope()`. The envelope today is `{ answerMarkdown, title?, needsGraph, diagramTitle?, scene? }`.
- `src/lib/ai/generate.ts` — `generateAnswer()` and `generateAnswerStream()` (streams `answerMarkdown` as it arrives; one retry on invalid JSON; records usage).
- `src/app/api/blocks/[blockId]/messages/route.ts` — the NDJSON streaming endpoint that orchestrates context, optional Exa web search, generation, persistence, and `syncGraphNode`.

**Scene / diagram DSL**
- `src/lib/dsl/types.ts` + `src/lib/dsl/schema.ts` — the `Scene` type and its Zod validator. Steps are integers; `step_start { title, description }` and `write_note { text, reason }` are the per-step narration source already present.
- `src/components/engine/*` — the R3F renderer. `BlockCanvas.tsx` mounts an orthographic `<Canvas>` with `preserveDrawingBuffer: true` (this is what makes `captureStream` export work). `SceneInterpreter.tsx` walks ops; `useSceneTimeline.ts` + `store/blockStore.ts` are the playback model (`play/pause/tick/jumpToOpIndex`, `speed`, `stepDelay`).

**Playback, narration, export (where Feature 2 lands)**
- `src/components/board/nodeTypes/GraphAnimationFullscreen.tsx` — the fullscreen player. Has the current **narration toggle** (`narrate` state → `window.speechSynthesis.speak(...)` per step) and the **video export button** (`handleExportVideo` → `recordCanvas`).
- `src/lib/board/videoExport.ts` — `recordCanvas(canvas, mimeType, fps)` via `canvas.captureStream()` (video only, **no audio track**), `pickVideoMimeType()`, `downloadBlob()`, `slugifyFilename()`.
- `src/lib/board/speech.ts` — `toSpeechText(markdown)` and `latexToSpeech(latex)`: strips markdown/LaTeX to speakable text. **Reuse this to build the TTS script.**
- `src/components/board/nodeTypes/MessageBubble.tsx` — the chat answer bubble; has a "Read aloud" button also using `speechSynthesis`.

**hackai-sdk usage precedent (important)**
- STT already runs through the Replicate proxy: `src/app/api/blocks/[blockId]/transcribe/route.ts` calls `hackAi.replicate.stt.incrediblyFastWhisper({ audio })` and normalizes the varied output with a small `extractText()` helper. **TTS follows the exact same pattern** — see §9.
- Voice **input** already exists (mic → `MediaRecorder` → `/transcribe`) in `PromptInput.tsx`. Feature 2 adds voice **output**.

**Env:** `HACKCLUB_AI_API_KEY` is already set (`.env`) and powers `hackAi`, including `hackAi.replicate.*`. **No new secret is required for TTS.**

---

## 5. Market & competitor research

### 5.1 The field

| Tool | Step-by-step? | Voice / video? | Interaction model | Pricing (2026) | Notes |
|---|---|---|---|---|---|
| **ChatGPT** (what the user compared us to) | Yes, strong reasoning; self-corrects when challenged | Voice mode (chat), no math video | Linear chat | $0 / $20 | The bar for *explanation & follow-up*, not for diagrams |
| **Photomath** (Google-owned) | Yes — "granular steps with named rules," 4.7/5 depth | Animated step transitions; no narrated video | Camera → solution | Free basic; Plus $9.99/mo | Math-only, **mobile-only** |
| **Symbolab** | Yes; full steps behind paywall | No | Equation input + practice gen | Pro $9.95/mo | Ties steps to practice problems |
| **Mathway** | Yes (Premium only) | No | Solver | Premium $9.99/mo | Widest subjects; billing complaints |
| **Wolfram\|Alpha** | Yes (Pro) | No | Computational query | Pro ~$5/mo | Expert-oriented; steep for students |
| **GeoGebra** | Yes, free | No | Graphing + solver | Free | Algebra→early calc; interactive graphs |
| **Gauth** (ByteDance) | Yes across subjects, 4.4/5 | AI chat + live human tutors | Photo → answer | Free + Plus | Among most-downloaded US edu apps '24–'25 |
| **Thetawise** | Yes; guided "Tutor Me" mode | **Generates personalized video lessons** | Socratic tutor | Free 50 msg/day; Pro opaque | Web-only; guided hints |
| **SnapXam** | Yes | **Short method videos** alongside steps | Web solver | $6.97/mo | Narrower coverage |
| **Khanmigo** (Khan Academy) | Socratic, guides not answers | Tutor voice; curriculum video library | Guided tutor | ~$4/mo | Won't just give the answer |
| **Mathos AI** ⭐ | Yes | **Narrated 2–5 min AI video in ~30s**, per problem | Photo/prompt → custom video | Freemium | **Closest direct competitor to our vision** |

### 5.2 What this means for openmaths

- **The category is commoditized on "answers." The moat is *how well you teach a specific hard step* and *how little friction there is to interrogate it.*** Photomath's 4.7 vs Gauth's 4.4 gap is entirely about step *quality and named justifications*. openmaths currently loses here for non-visual problems.
- **Narrated explanation video is now table stakes at the frontier** (Mathos, SnapXam, Thetawise). We already have the *animation engine and step captions* — we are one TTS integration away from a shareable narrated video, and our animation is **live, interactive (parametric sliders, hover-linked labels), and progressive**, which pre-rendered competitors are not.

### 5.3 openmaths' defensible whitespace (lean into these)

1. **Non-linear canvas.** No competitor has a node graph of connected questions → sub-questions → diagrams → notes → web sources. Exploration and branching is unique; keep it central.
2. **Live, teacher-style progressive construction** (build the figure one idea per step) rather than a pre-baked video — plus parametric sliders and hover-to-highlight linking between prose and geometry.
3. **The fix in this PRD closes the two gaps** that keep it a demo: (a) reasoning quality for non-visual problems, (b) a real narrated, shareable video. Do both and openmaths is differentiated *and* competitive.

*Sources: see the "Sources" list delivered with this PRD.*

---

## 6. Feature 1 — Real step-by-step explanation engine (non-visual first)

### 6.1 Product intent
When the hard part of a problem is the *reasoning*, the explanation must stand on its own — correct, discrete, and interrogable — **whether or not there is a diagram**. The diagram becomes a supporting actor, not the whole show.

### 6.2 UX
- A QUESTION node's answer renders as a **numbered solution**: each step has a one-line **claim** (what we now know) and, on a "Why?" disclosure, the **justification** (theorem/definition/prior-step). This mirrors the diagram sidebar's existing `text` + "Why?" `reason` pattern in `GraphAnimationFullscreen.tsx`, so it will feel native.
- The **final answer is visually pinned** (boxed/badged) at the end of the solution.
- Diagram, when present, still appears inline at the `[[DIAGRAM]]` marker (existing behavior in `MessageBubble.tsx`) — but it is no longer required for a good answer.
- Follow-up / challenge already works via per-node chat history and the `SelectionToolbar` "ask about this selection" flow — keep as-is; Feature 1 raises the *quality* of the answers those follow-ups get.

### 6.3 Data model — extend the envelope (backward-compatible)
In `src/lib/ai/envelope.ts`, add an **optional** structured solution so nothing breaks if the model omits it:

```ts
// new: a discrete reasoning step, visual-independent
const SolutionStepSchema = z.object({
  claim: z.string().min(1),        // "△BGC is right-angled at G"
  detail: z.string().optional(),   // markdown+LaTeX working for this step
  reason: z.string().optional(),   // the "why?" — theorem/definition/prior step
});

export const GenerationEnvelopeSchema = z.object({
  answerMarkdown: z.string().min(1),         // keep — prose fallback & streaming target
  title: z.string().max(60).optional(),
  solution: z.array(SolutionStepSchema).max(12).optional(),  // NEW
  finalAnswer: z.string().max(200).optional(),               // NEW — the boxed result
  needsGraph: z.boolean(),
  diagramTitle: z.string().max(60).optional(),
  scene: SceneSchema.optional(),
}).refine(d => !d.needsGraph || d.scene !== undefined, { /* unchanged */ });
```

Rationale: `answerMarkdown` remains the streaming payload (great perceived latency) and the fallback renderer; `solution[]` + `finalAnswer` power the structured, "why?"-expandable view and — critically — become the **narration script** for Feature 2.

### 6.4 Prompt changes (`src/lib/ai/prompt.ts`)
1. **Rebalance `needsGraph`.** Today the contract says "default to true for ANY problem involving a named shape." Change to: *include a figure only when it materially helps a student follow the reasoning; for problems whose difficulty is arithmetic/theorem-driven (e.g. area from the centroid ratio), the figure is secondary and may be minimal or omitted. **Never let the figure replace the reasoning.***
2. **Require the structured `solution[]`** for any multi-step problem: one idea per step, each with a `reason`. Mirror the existing high-quality guidance already written for `write_note.text`/`reason` (be specific, name the theorem).
3. **Require `finalAnswer`** as the explicit result string, separate from prose.
4. **Add a self-check instruction:** *before finalizing, verify the final answer by an independent check (re-derive, plug back in, or sanity-check magnitude); if it disagrees, fix it.* (This is the cheap, prompt-level correctness win that turns 24 → 72.)

### 6.5 Correctness self-check (server)
Add a lightweight verification pass in `src/lib/ai/generate.ts` (new `verifyAnswer` helper, gated behind a `VERIFY = true` const so it's easy to toggle):
- After a valid envelope, make **one** additional `hackAi.chat.completions.create` call (low temperature) that receives the problem + `finalAnswer` + `solution[]` and returns `{ ok: boolean, correctedFinalAnswer?, correctedSolution?, note? }`.
- If `ok === false`, patch the envelope with the corrections before returning.
- Keep it behind reasoning-effort/complexity heuristics if latency matters (e.g. only verify when `solution.length >= 3`). Record the extra call in usage exactly like the retry path already does.

> Cost note: one extra short completion per hard problem. Acceptable for correctness; make it toggleable and skip it for `casual`/note-writing paths.

### 6.6 Rendering (`src/components/board/nodeTypes/`)
- New component `SolutionSteps.tsx`: renders `envelope.solution` as a numbered list; each item shows `claim` (bold), optional `detail` via the existing `ReactMarkdown` + `remark-math` + `rehype-katex` setup (reuse `getMarkdownComponents`), and a `<details>` "Why?" for `reason` — identical affordance to the diagram sidebar.
- `MessageBubble.tsx`: when the persisted assistant message has structured solution data, render `SolutionSteps` above/around the prose; otherwise fall back to today's `answerMarkdown` rendering. Pin `finalAnswer` in a highlighted chip at the end.
- **Persistence:** structured solution must survive reloads. Store it on the assistant `Message`. Prisma `Message` already has `attachments Json?`; add a dedicated `solution Json?` (and optionally `finalAnswer String?`) to the `Message` model (`prisma/schema.prisma`) + a migration, and write it in the `messages` route where the assistant message is created. (Do **not** overload `attachments`.)

### 6.7 Files to change (Feature 1)
- `src/lib/ai/envelope.ts` — schema additions.
- `src/lib/ai/prompt.ts` — `ENVELOPE_CONTRACT` copy, `needsGraph` rebalance, self-check instruction.
- `src/lib/ai/generate.ts` — optional `verifyAnswer` pass; thread `solution`/`finalAnswer` through both non-stream and stream paths.
- `prisma/schema.prisma` (+ migration) — `Message.solution Json?`, `Message.finalAnswer String?`.
- `src/app/api/blocks/[blockId]/messages/route.ts` — persist `solution`/`finalAnswer` on the assistant message; include in the `done` event.
- `src/components/board/nodeTypes/SolutionSteps.tsx` (new) and `MessageBubble.tsx` — rendering.
- `src/lib/board/types.ts` / `apiMappers.ts` — carry the new message fields to the client.

### 6.8 Acceptance criteria (Feature 1)
- AC1. The north-star problem (§11) returns **72** with the three-step centroid reasoning, each step "Why?"-expandable, `finalAnswer = "72 square units"`.
- AC2. A purely computational problem (e.g. "solve 3x + 7 = 22") returns clean steps with **no diagram** and no forced/irrelevant figure.
- AC3. Structured solution persists across reload and renders from the DB (not only from the live stream).
- AC4. Existing diagram-first problems (Pythagoras proof, etc.) still render their figure inline at `[[DIAGRAM]]` and are unregressed.
- AC5. With the self-check on, a deliberately tricky ratio/area problem is corrected rather than shipped wrong.

---

## 7. Feature 2 — Voice narration & voice-on-video (hackai-sdk TTS)

### 7.1 Product intent
Turn the animation into a **shareable, narrated video** and make in-app narration sound human — using `hackai-sdk` TTS with **one server-chosen voice** and **no model/voice picker for users**.

### 7.2 The narration script
Build the per-step script from what already exists, in this priority:
1. If Feature 1's `solution[]` is present → one narration line per step: `claim` + (`detail`/`reason` spoken briefly).
2. Else, for a diagram, reuse the current fullscreen logic: `step_start.title` + `step_start.description` + the step's `write_note.text`.
Run every line through `toSpeechText()` (`src/lib/board/speech.ts`) so LaTeX becomes speakable. This gives a `NarrationScript = { step: number, text: string }[]`.

### 7.3 TTS integration — single model, no selection
Add `src/lib/ai/tts.ts`, mirroring the STT precedent in `transcribe/route.ts`:

```ts
import { hackAi } from "@/lib/ai/client";

// The ONE model. Fixed server-side. Never exposed to users, never a request param.
// minimax/speech-02-turbo — fast, cheap, multilingual (see hackai-sdk README §"Text to Speech").
const TTS_VOICE = "Friendly_Person"; // pick a fixed voice id from the model's schema

export async function synthesizeSpeech(text: string): Promise<string> {
  // ReplicateInput is Record<string, unknown>; confirm exact field names for
  // minimax/speech-02-turbo at https://ai.hackclub.com/replicate (text + voice fields).
  const output = await hackAi.replicate.tts.speechTurbo({ text, voice_id: TTS_VOICE });
  const url = extractAudioUrl(output);       // see transcribe route's extractText() pattern
  if (!url) throw new Error("TTS returned no audio");
  return url;
}

// Replicate outputs vary (URL string | string[] | FileOutput). Normalize like extractText().
function extractAudioUrl(output: unknown): string | null { /* ... */ }
```

**Rules that enforce "no model selection":** `TTS_VOICE` and the `speechTurbo` choice are module constants. The API route accepts **no** model/voice parameter. There is **no** TTS entry in Settings > Model (`ModelSettings.tsx`) and **no** picker in any player/export UI. (The existing per-block `ModelEffortButton` governs the *text* LLM only — leave it; it is unrelated to TTS.)

### 7.4 Server route
`src/app/api/blocks/[blockId]/narrate/route.ts` (POST):
- Auth + `canvasAccessWhere` like every other block route.
- Body: `{ steps: { step: number, text: string }[] }` (script computed client-side, or recomputed server-side from the block's scene/solution — prefer server-side recompute so the client can't inject arbitrary long text).
- For each step, call `synthesizeSpeech(text)`; **fetch the audio bytes** and return them to the client as data URLs (or proxy bytes) so both `<audio>` playback and `MediaRecorder` capture work without cross-origin issues:
  `{ clips: [{ step, audioDataUrl, durationMs }] }` (compute `durationMs` by decoding, or return it if the model provides it).
- **Cache** to avoid re-synthesis: add `Block.narration Json?` (Prisma migration) storing `{ voice, script hash, clips: [{ step, audioUrl|audioDataUrl, durationMs }] }`. Regenerate only when the scene/solution (hash) changes. Record a usage `ActivityEvent` (reuse the `BLOCK_GENERATED`/metadata pattern) so voice cost is visible in Settings > Usage.

### 7.5 In-player narration (replace robotic TTS)
In `GraphAnimationFullscreen.tsx`:
- Keep the existing `narrate` toggle button (the `Volume2`/`VolumeX` control) and its a11y labels.
- On enabling narration (or lazily on first play): POST the script to `/narrate`, receive clips, cache in a `ref` keyed by step.
- **Replace** `window.speechSynthesis.speak(...)` with playing the step's audio clip through a shared `AudioContext` (see §7.6). Remove/great-degrade the `speechSynthesis` path (keep it only as a fallback if TTS fails).
- **Sync:** when narration audio is on, advance to the next step only when the current clip ends (drive the existing `timeline` — e.g. call `timeline.animateStepForward()` on the audio element's `ended` event, or set `timeline.setStepDelay(clip.durationMs/1000)`), so speech and drawing stay aligned instead of the current fire-and-forget behavior.

### 7.6 Voice-on-video export (the headline)
Add a **second export affordance** in the player controls next to the existing video button: **"Export video with voiceover"** (label it clearly; keep the current silent export too). Implement audio muxing by extending `src/lib/board/videoExport.ts`:

```ts
// New: record canvas video AND a live audio stream into one WebM.
export function recordCanvasWithAudio(
  canvas: HTMLCanvasElement,
  audioStream: MediaStream,     // from an AudioContext destination (below)
  mimeType: string,
  fps = 30,
): { stop: () => void; result: Promise<Blob> } {
  const video = canvas.captureStream(fps);
  const combined = new MediaStream([
    ...video.getVideoTracks(),
    ...audioStream.getAudioTracks(),   // <-- the piece missing today
  ]);
  const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 6_000_000 });
  /* ...same chunk collection / onstop as recordCanvas... */
}
```

Export flow in `handleExportVideoWithVoice()` (new, alongside `handleExportVideo`):
1. Ensure clips exist (`/narrate`), build one `AudioContext` + `MediaStreamAudioDestinationNode` (`ctx.createMediaStreamDestination()`).
2. `timeline.reset()`, wait for a paint (existing double-`requestAnimationFrame` trick), then start `recordCanvasWithAudio(canvas, dest.stream, mime)`.
3. Drive playback **step by step, gated on audio**: for each step, `scrubToStep`/`animateStepForward`, create a `MediaElementAudioSourceNode` (or `AudioBufferSourceNode`) for that step's clip routed to `dest`, and only advance after the clip's `ended`. This guarantees the recorded audio track is synced to the drawing.
4. After the last step + a short tail, `stop()`, then `downloadBlob(blob, \`${slug}-narrated.webm\`)`.
5. Reuse `pickVideoMimeType()` and its unsupported-browser toast.

> Fallback: if `MediaRecorder`/WebM audio isn't supported, or TTS fails, cleanly fall back to the existing **silent** export with a toast ("Voiceover unavailable — exported without audio"). Never block the silent export.

### 7.7 Chat "Read aloud" upgrade (small, optional)
`MessageBubble.tsx`'s "Read aloud" can call the same `synthesizeSpeech` (via a tiny `/narrate`-style endpoint or a shared client helper) instead of `speechSynthesis`, for a consistent voice. Nice-to-have; not required for v1.

### 7.8 Files to change (Feature 2)
- `src/lib/ai/tts.ts` (new) — `synthesizeSpeech`, `extractAudioUrl`, fixed model/voice constants.
- `src/app/api/blocks/[blockId]/narrate/route.ts` (new) — script → clips, caching, usage event.
- `prisma/schema.prisma` (+ migration) — `Block.narration Json?`.
- `src/lib/board/videoExport.ts` — `recordCanvasWithAudio()`.
- `src/components/board/nodeTypes/GraphAnimationFullscreen.tsx` — real-TTS narration playback + new "Export with voiceover" button + audio-gated sync.
- `src/lib/board/speech.ts` — reuse `toSpeechText`; add a `buildNarrationScript(scene, solution?)` helper here or in `tts.ts`.
- (optional) `MessageBubble.tsx` — swap "Read aloud" to real TTS.

### 7.9 Acceptance criteria (Feature 2)
- AC6. Turning on narration in the fullscreen player plays a **human-sounding** voice (not `speechSynthesis`) that is **synced** to each step (drawing waits for speech).
- AC7. "Export video with voiceover" produces a **single WebM with an audible, synced narration track** for a multi-step diagram.
- AC8. There is **no** TTS voice/model selector anywhere (Settings, player, export). The model is a code constant.
- AC9. Re-exporting the same unchanged diagram does **not** re-synthesize (served from `Block.narration` cache).
- AC10. TTS failure or an unsupported browser degrades gracefully to the existing silent export with a clear toast.
- AC11. Voice generations appear in Settings > Usage (an `ActivityEvent` is recorded).

---

## 8. Phased rollout

**Phase 0 — Spike (½ day).** Prove `hackAi.replicate.tts.speechTurbo(...)` end-to-end in a throwaway route: confirm the exact input field names & voice id at `https://ai.hackclub.com/replicate`, and that output normalizes to a playable audio URL. De-risks everything in Feature 2.

**Phase 1 — Explanation quality (Feature 1 core).** Envelope `solution[]` + `finalAnswer`, prompt rebalance + self-check instruction, `SolutionSteps` rendering, persistence. Ship AC1–AC4.

**Phase 2 — Correctness self-check.** `verifyAnswer` pass + usage accounting. Ship AC5.

**Phase 3 — Real in-app narration.** `tts.ts`, `/narrate` route + caching, swap player narration to real TTS with step sync. Ship AC6, AC8, AC9, AC11.

**Phase 4 — Voice-on-video export.** `recordCanvasWithAudio`, "Export with voiceover" button, audio-gated capture, graceful fallback. Ship AC7, AC10.

**Phase 5 — Polish.** Chat "Read aloud" via real TTS; loading/spinner states; a "Narrated video" empty-state hint. Optional.

---

## 9. hackai-sdk TTS reference (for the implementer)

From `@razinmohammedpt/hackai-sdk@1.1.0` (`client.replicate.tts.*`, README §"Text to Speech"):

| Method | Model | Use |
|---|---|---|
| `speechTurbo` | `minimax/speech-02-turbo` | **Default choice** — fast, cheap, multilingual |
| `speech28Turbo` | `minimax/speech-2.8-turbo` | Newer, expressive |
| `speech28Hd` | `minimax/speech-2.8-hd` | Studio-grade (slower/pricier) |
| `chatterboxPro`, `dia`, `xttsV2`, `qwen3Tts`, `realtimeTts15Mini/Max` | various | Alternatives; not needed v1 |

- Signature: `speechTurbo(input: ReplicateInput): Promise<ReplicateOutput>` where `ReplicateInput = Record<string, unknown>` and output is `unknown` (URL string | array | FileOutput) — **normalize it**, exactly like `extractText()` in `transcribe/route.ts`.
- README example shape: `client.replicate.tts.chatterboxPro({ voice: "...", prompt: "..." })`. **Confirm minimax's exact fields (`text`, `voice_id`, etc.) at `https://ai.hackclub.com/replicate`** before wiring — do not guess the field names in production.
- Auth: reuses `HACKCLUB_AI_API_KEY` (already configured). No new env var.
- Precedent to copy verbatim in style: `src/app/api/blocks/[blockId]/transcribe/route.ts`.

---

## 10. Risks & mitigations
- **R1 — TTS input schema mismatch.** Mitigate with Phase 0 spike; keep the model in one constant so a field change is a one-line fix.
- **R2 — Audio/video sync drift in export.** Mitigate by gating step advancement on the `ended` event (don't free-run the timeline during narrated capture).
- **R3 — Latency (extra self-check + TTS calls).** Make self-check toggleable and heuristic-gated; pre-generate/cache narration on `Block.narration`; show clear "Generating voice…" states.
- **R4 — Large audio in Postgres.** Prefer storing Replicate audio **URLs** + `durationMs` in `Block.narration`, not base64 blobs; only return data URLs transiently to the client for capture.
- **R5 — Browser support (Safari/WebM).** Already handled by `pickVideoMimeType()` returning `null`; extend the same guard to the narrated path.
- **R6 — Regressing diagram-first problems** while rebalancing `needsGraph`. Mitigate with AC4 and keep a couple of geometry problems in the manual test set.

---

## 11. North-star acceptance test

**Input:** *"In a triangle ABC, the medians from B and from C meet at G. Given BG = 8, CG = 6, BC = 10, find the area of triangle ABC."*

**Must produce:**
1. Final answer **72 square units** (boxed/pinned `finalAnswer`).
2. A structured `solution[]` with ≥3 steps, each "Why?"-expandable:
   - G is the centroid ⇒ medians split `2:1`.
   - `BG² + CG² = BC²` (64 + 36 = 100) ⇒ △BGC right-angled at G ⇒ `[BGC] = ½·8·6 = 24`.
   - Centroid ⇒ `[BGC] = ⅓·[ABC]` ⇒ `[ABC] = 3·24 = 72`.
3. Either **no diagram** or a *correct, clearly-secondary* figure — never the misleading "area = ½·8·6 = 24 is the answer" diagram.
4. With narration on: a synced human voice reads the three steps; "Export with voiceover" yields one narrated WebM.
5. If the student replies *"why 3 and not 6?"*, the follow-up answer correctly explains the centroid area ratio (the reasoning must be robust to challenge).

Ship when this passes and AC1–AC11 hold.

---

## 12. Appendix — quick file index

**Change for Feature 1:** `ai/envelope.ts`, `ai/prompt.ts`, `ai/generate.ts`, `prisma/schema.prisma`, `api/blocks/[blockId]/messages/route.ts`, `board/nodeTypes/SolutionSteps.tsx` (new), `board/nodeTypes/MessageBubble.tsx`, `board/types.ts`, `board/apiMappers.ts`.

**Change for Feature 2:** `ai/tts.ts` (new), `api/blocks/[blockId]/narrate/route.ts` (new), `prisma/schema.prisma`, `board/videoExport.ts`, `board/nodeTypes/GraphAnimationFullscreen.tsx`, `board/speech.ts`, (optional) `board/nodeTypes/MessageBubble.tsx`.

**Copy the pattern from:** `api/blocks/[blockId]/transcribe/route.ts` (Replicate proxy + output normalization), `GraphAnimationFullscreen.tsx` `handleExportVideo` (recording lifecycle), the diagram sidebar's `text`/"Why?" `reason` disclosure (structured-step UX).
