# openmaths — PRD v2 (Production): Multi-Form Explainer, Psychology-Driven UX, Per-Step AI Voice

| | |
|---|---|
| **Product** | openmaths — an AI math explainer that *teaches*, not just answers |
| **Version** | 2.0 (production-ready) — supersedes PRD v1 (`docs/PRD-explanations-and-voice.md`) and absorbs its two features |
| **Author** | Razin (with Claude) |
| **Date** | 2026-08-20 |
| **Audience** | Claude Code (implementing agent) working in this repo |
| **Stack** | Next.js 16 · React 19 · Prisma 7 / Postgres · `@xyflow/react` canvas · R3F (three.js) engine · KaTeX · `@razinmohammedpt/hackai-sdk` (all AI, incl. Replicate proxy) |

> **Read order for the implementer:** §3 (design principles — these govern every decision) → §4 (current app, what to preserve) → §5 (the Form architecture — the renderer change) → §6/§7/§8 (the three feature pillars) → §9 (production readiness) → §10 (data model) → §11 (phases) → §12 (acceptance) → §13 (north-star test). **Nothing in the current app may regress** — §5.4 is the binding compatibility contract.

---

## 1. Vision & the one-line bet

Every competitor answers the question. **openmaths wins by making the *understanding* stick** — a correct, structured, interrogable solution in whatever *form* the problem demands (a geometry animation, a graph, an algebra derivation, a table), narrated step-by-step in a human voice, on a non-linear canvas you can branch and explore. The bet: *teaching quality × format-fit × low friction* beats *another box that spits out a number*.

Two things make it production-grade rather than a demo:
1. **Correctness we can trust** (LLMs err) — declarative rendering + a deterministic verification pass.
2. **A product shaped by how people actually learn and stay** — evidence-based learning science and behavioral UX, applied without dark patterns.

---

## 2. Goals & non-goals

**Goals**
- G1. **Multiple forms.** Answers render in the *right* representation: geometry (animated canvas — existing), function/coordinate plots (existing ops), **algebra/step derivations, tables, matrices, systems (new DOM/KaTeX forms)**, or plain reasoning — the model picks per problem.
- G2. **Rendering architecture that adds forms with zero feature loss.** Keep the WebGL engine for geometry/3D/video; add DOM/KaTeX form renderers; unify them behind one "Form" abstraction. Everything that works today keeps working (§5.4).
- G3. **Real step-by-step explanations** that stand alone for non-visual problems, with correctness self-check (absorbs PRD v1 Feature 1).
- G4. **Per-step AI voice**, generated **one step at a time**, synced to the animation, and muxed into an exportable narrated video — via `hackai-sdk` Replicate **TTS** (absorbs PRD v1 Feature 2, corrected & expanded — see §8 on Whisper).
- G5. **Psychology-driven, production UX**: cognitive-load discipline, progress/closure cues, active-recall checkpoints, delight — all opt-out-able, no dark patterns.
- G6. **Production hardening**: performance budgets, accessibility (WCAG 2.1 AA), error/empty/loading states, telemetry, cost controls, caching, tests, migrations, feature flags.

**Non-goals**
- N1. No new AI provider — everything on `hackAi.*`.
- N2. No user-facing TTS voice/model picker (single server constant; §8).
- N3. No GeoGebra/Desmos dependency (decided: bespoke engine + DOM forms).
- N4. No aggressive/manipulative gamification (streak-guilt spam, fake urgency) — §3.3.
- N5. No physics/chemistry expansion in v2 — math-first.

---

## 3. Design principles (research-backed — these govern the build)

These are not decoration; each maps to concrete UI rules below and is cited in §14.

### 3.1 Learning science (how humans actually learn math)
- **Cognitive Load Theory — manage intrinsic, cut extraneous.** One idea per step; never flash the finished figure or a wall of text. (Your DSL already enforces "progressive construction, one idea per step" — extend that discipline to *every* form.)
- **Segmenting.** Chunk into short, self-paced units; per-step reveal with the learner in control (you have this in the diagram player — make it the norm for all forms).
- **Signaling.** Highlight the element under discussion (color/arrow/emphasis) to cut extraneous load. You already have prose↔geometry hover-linking (`HighlightableText` ↔ `SceneInterpreter`); make signaling *automatic* as narration reaches each step.
- **Weeding.** Remove decorative noise from explanation views and exported video (no background music, no clutter) — proven to raise retention.
- **Dual-channel / modality matching.** Pair **narration + animation**, never narration + identical on-screen text read verbatim (redundancy *hurts*). Drives the voice design in §8.
- **Worked-example effect + fading.** Show fully worked steps with visible justifications ("Why?"), then invite the learner to try the next similar step. This is the pedagogical core of Feature §7.
- **Active recall & spacing.** Cheap, high-impact: an optional one-tap "check your understanding" prompt at a step boundary beats passive watching.

### 3.2 Behavioral UX (how top products keep people moving)
- **Progressive disclosure.** Reveal depth on demand ("Why?", "show full working") so the default view is calm. (Mirrors your diagram sidebar's `reason` disclosure — generalize it.)
- **Zeigarnik effect / endowed progress.** Visible step progress ("Step 2 / 5", a progress bar) creates the pull to finish. You already show step counters — make progress a first-class, satisfying element.
- **Hick's & Fitts's laws.** Few, large, obvious primary actions per surface; the main CTA (Ask / Play / Narrate / Export) is unmistakable and reachable.
- **Jakob's law.** Match the mental models students already hold from ChatGPT/Photomath (a clear "answer", numbered steps, a play button, a share/export) — don't make them relearn.
- **Aesthetic-usability + peak-end.** A polished, delightful *finish* (a clean final-answer reveal, a smooth narrated replay) is disproportionately remembered.
- **Priming/framing.** Tell the student what's coming ("3 steps to the area"), frame CTAs by value ("Hear it explained") not mechanics ("TTS").

### 3.3 Ethical engagement (Duolingo's lessons — the good and the dark)
- Use **white-hat** motivation: mastery, accomplishment, meaning — badges/streaks only if they represent *genuine* learning, never trivial clicks.
- If any streak/goal is added, ship the **forgiveness valve first** (streak-freeze reduced churn 21% *because* it cut anxiety). Every engagement feature has an **opt-out**.
- **Avoid** pushy notification guilt, fake urgency, ads-as-completion, and the overjustification trap (don't bolt extrinsic rewards onto the intrinsically satisfying "I finally get it" moment). v2 ships **no** manipulative loops.

---

## 4. Current app — what exists and must be preserved

openmaths is already sophisticated. **Extend, don't rewrite.** Key surfaces:

- **Generation:** `src/lib/ai/{client,prompt,generate,envelope}.ts` — the LLM returns an envelope `{ answerMarkdown, title?, needsGraph, diagramTitle?, scene? }`; streamed via NDJSON in `src/app/api/blocks/[blockId]/messages/route.ts`. Retry-on-invalid-JSON + usage metering already exist.
- **Diagram DSL & engine:** `src/lib/dsl/{types,schema,resolveScene,expr}.ts` (flat, Zod-validated ops, parametric bindings) rendered by `src/components/engine/*` on a `preserveDrawingBuffer` WebGL canvas (`BlockCanvas.tsx`), walked by `SceneInterpreter.tsx`, timed by `useSceneTimeline.ts` + `store/blockStore.ts`.
- **Player / narration / export:** `GraphAnimationFullscreen.tsx` (step sidebar, per-step captions, **narration toggle** using browser `speechSynthesis`, **video export** via `videoExport.ts` `recordCanvas` — video-only, no audio).
- **Canvas product:** node graph (`Board.tsx`, `BoardCanvas.tsx`) of QUESTION / SUB_QUESTION / GRAPH / NOTE / LINK blocks; per-node chat with history; `@`-mentions; skills (`/`); Exa web search; per-block model/effort; PDF export; sharing/collab; usage dashboard.
- **Voice input already works:** mic → `MediaRecorder` → `/transcribe` → `hackAi.replicate.stt.incrediblyFastWhisper` (`PromptInput.tsx`). This is **Whisper's correct role — input** (see §8).
- **Env:** `HACKCLUB_AI_API_KEY` already powers `hackAi`, including `hackAi.replicate.*`. No new secret needed for TTS.

---

## 5. The Form architecture (the rendering change — additive, zero loss)

### 5.1 Problem with today's model
The app treats "explanation" as "prose + (optionally) one WebGL geometry scene." That forces geometry rendering onto problems whose right representation is an **algebra derivation, a function graph, a table, or just reasoning** — and (per your own report) it produces wrong/misleading figures for non-spatial problems.

### 5.2 Concept: an answer is composed of typed **Forms**
Introduce a **Form** = one renderable unit of an answer, chosen by the model to fit the content. A single answer can contain several, in order (prose interleaved with forms, exactly like today's `[[DIAGRAM]]` marker, generalized).

**Form kinds (v2):**

| Form | Renderer | Source of truth | Status |
|---|---|---|---|
| `prose` | DOM (ReactMarkdown + KaTeX) | `answerMarkdown` segments | exists |
| `solution_steps` | **DOM/KaTeX** (new `SolutionSteps.tsx`) | structured `solution[]` (§7) | **new** |
| `geometry` | **WebGL engine** (existing `BlockCanvas`) | `Scene` (existing DSL) | exists — unchanged |
| `plot` | **WebGL engine** (existing `draw_axes/grid/function/parabola` ops) | `Scene` with plot ops | exists — surfaced explicitly |
| `table` / `matrix` | **DOM/KaTeX** (new `TableForm.tsx`) | `tableData` (rows/headers, LaTeX cells) | **new** |
| `number_line` | WebGL engine (existing ops) | `Scene` | exists |

**Accuracy rationale (your #3 concern):** DOM/KaTeX forms have **no coordinate/sampling error surface** — the model emits symbolic LaTeX and it renders verbatim, checkable by a CAS. Reserve WebGL for what genuinely needs it (geometry, pseudo-3D, and the captured video). Prefer **declarative ops the engine computes** (`draw_function`, `draw_regular_polygon`) over model-hand-computed coordinates. (See §7.4 verification.)

### 5.3 How the model picks a Form
Extend the envelope so the model declares an ordered `forms` list instead of the single `needsGraph` boolean — **while keeping `needsGraph`/`scene` working** as a compatibility alias (§5.4):

```ts
// envelope.ts — additive
const FormSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("prose"), markdown: z.string() }),
  z.object({ kind: z.literal("solution_steps"), steps: z.array(SolutionStepSchema).max(12) }),
  z.object({ kind: z.literal("geometry"), scene: SceneSchema, title: z.string().max(60).optional() }),
  z.object({ kind: z.literal("plot"),     scene: SceneSchema, title: z.string().max(60).optional() }),
  z.object({ kind: z.literal("number_line"), scene: SceneSchema }),
  z.object({ kind: z.literal("table"), headers: z.array(z.string()), rows: z.array(z.array(z.string())) }),
]);

export const GenerationEnvelopeSchema = z.object({
  answerMarkdown: z.string().min(1),           // KEEP — streaming target + fallback
  title: z.string().max(60).optional(),
  finalAnswer: z.string().max(200).optional(), // NEW — the boxed result
  forms: z.array(FormSchema).max(6).optional(), // NEW — ordered composition
  // ---- back-compat (still accepted & honored) ----
  needsGraph: z.boolean().optional(),
  diagramTitle: z.string().max(60).optional(),
  scene: SceneSchema.optional(),
}).refine(/* if needsGraph true and no forms, scene required */);
```

**Prompt change (`prompt.ts`):** teach the model the Form menu and *when* to use each (geometry/plot only when a picture materially helps; `solution_steps` for algebra/arithmetic/proofs; `table` for enumerations/truth tables/comparison; prose to connect them). Kill the "default `needsGraph` true for any shape" bias. Preserve all the excellent existing DSL/geometry guidance for the `geometry`/`plot` forms verbatim.

### 5.4 ✅ Compatibility contract — NOTHING regresses (binding)
The refactor is additive. A back-compat shim maps the old shape to the new: `needsGraph:true + scene` ⇒ a single `{kind:"geometry", scene}` form. Every one of these **must still work, identically, after the change** (treat as regression tests):

- Progressive per-op drawing, `AiCursor`, per-step reveal, `step_start`/`write_note` captions.
- Timeline: play/pause/step/scrub/skip, `speed`, `stepDelay`, keyboard shortcuts (`GraphAnimationFullscreen`).
- Step sidebar + "Why?" disclosures; prose↔geometry hover-highlight linking.
- Parametric **sliders** (`variables`/`bindings`, `resolveScene`).
- **WebM video export** (`recordCanvas`, `preserveDrawingBuffer`, `captureStream`).
- Fullscreen player, node static preview, zoom controls, collapse.
- PDF export (`export-pdf`), sharing/collab, Exa search, skills, `@`-mentions, per-block model/effort, usage metering, voice **input** (Whisper).

Persisted GRAPH blocks (existing DB rows) render unchanged via the shim. Add a migration only for *new* data (§10), never a destructive change to `Scene`.

### 5.5 Files (Form architecture)
`ai/envelope.ts`, `ai/prompt.ts`, `ai/generate.ts` (thread `forms`), `api/blocks/[blockId]/messages/route.ts` (persist + emit forms; keep GRAPH sync for geometry/plot forms), new `components/board/forms/{FormRenderer,SolutionSteps,TableForm}.tsx`, `MessageBubble.tsx` (render the `forms[]` in order; prose/steps/table inline, geometry/plot via the existing GRAPH node/`BlockCanvas`), `lib/board/types.ts` + `apiMappers.ts`.

---

## 6. Feature pillar A — Multiple forms (the visible payoff of §5)
- **Algebra step derivation (`solution_steps`)**: a vertical KaTeX stack; each row shows the line of working plus the operation applied (e.g. "subtract 7", "÷ 3") and an on-demand "Why?". Renders inline in the answer — no canvas, no coordinates, fully CAS-checkable.
- **Tables/matrices/systems (`table`)**: DOM table with KaTeX cells; good for truth tables, sign charts, comparison, simultaneous equations.
- **Function/coordinate `plot`**: uses existing engine ops (`draw_axes`, `draw_grid`, `draw_function`, `draw_parabola`, `shade_region`) — model emits the *expression*, engine samples (accurate). Surfaced as its own form so the model reaches for it on "graph …" problems.
- **Geometry / number_line**: unchanged WebGL engine.
- **Acceptance:** a linear-equation solve renders clean algebra steps with **no diagram**; "graph y = x²−4 and shade …" renders a correct plot; "truth table for p→q" renders a table; the centroid problem renders reasoning steps + an optional secondary figure (§13).

---

## 7. Feature pillar B — Real step-by-step explanations + correctness
(Absorbs PRD v1 Feature 1; now expressed as the `solution_steps` form.)

- **Structured solution.** `SolutionStepSchema = { claim, detail?, reason? }` (claim = what we now know; detail = markdown/LaTeX working; reason = the justification behind the "Why?"). `finalAnswer` is pinned/boxed at the end.
- **Prompt.** Require one idea per step with a specific, named justification (reuse the high bar already written for `write_note`); require a self-check before finalizing.
- **Correctness self-check (server, `generate.ts`).** After a valid envelope, run one low-temp verification pass (and/or a deterministic CAS — `mathjs` server-side, or a small `sympy` service) over `finalAnswer` + key relations; patch on disagreement. Gate by complexity (`steps ≥ 3`) and a `VERIFY` flag; record the extra call in usage. **This is the top accuracy lever and is renderer-independent.**
- **Interrogation loop.** Per-node chat history already supports "why 3 not 6?" follow-ups; quality of those answers rides on this pillar. Keep the `SelectionToolbar` "ask about this selection" flow.
- **Acceptance:** north-star (§13) returns **72** with 3 justified steps; pure-computation problems produce no forced figure; structured steps persist across reload.

---

## 8. Feature pillar C — Per-step AI voice + narrated video

### 8.1 Correction: Whisper ≠ voice generation
**Whisper is speech-to-text (STT).** It transcribes; it cannot synthesize speech, and there is no OpenAI/ChatGPT TTS on the HackClub Replicate proxy. Whisper stays exactly where it is — **voice input** (`/transcribe`). To **generate** per-step narration we use the SDK's **TTS** helpers: `hackAi.replicate.tts.*`. *(If you later want a specific OpenAI-style voice, it would require a different provider outside this SDK — out of scope; flagged so the choice is explicit.)*

### 8.2 Single fixed model, no user selection
Pick **one** TTS model server-side and never expose a picker (Settings, player, export all stay picker-free). Default: `hackAi.replicate.tts.speechTurbo` (`minimax/speech-02-turbo` — fast & cheap, right for many short per-step calls); `realtimeTts15Mini` is the low-latency alternative. Voice id + model are module constants in `src/lib/ai/tts.ts` (mirror the `extractText` normalization from `transcribe/route.ts`; confirm exact input fields at `https://ai.hackclub.com/replicate`).

### 8.3 Voice generated for each step, one by one (core requirement)
- The narration **script is per step**, built from the step's content: for a `solution_steps` form → the `claim` (+ brief `reason`); for a `geometry/plot` form → `step_start.title` + `description` + that step's `write_note.text`. Run each line through `toSpeechText()` (`speech.ts`) so LaTeX is spoken correctly. **Modality rule (§3.1):** narrate a *spoken paraphrase*, not the on-screen text verbatim (redundancy hurts learning).
- **Server route `POST /api/blocks/[blockId]/narrate` streams clips step-by-step** (NDJSON, like the messages route): it synthesizes step 1, emits `{ step:1, audioDataUrl, durationMs }`, then step 2, etc. The client can **start playing step 1 while step 2 is still synthesizing** (pipeline) so narration begins almost immediately instead of waiting for the whole script.
- **Cache** on `Block.narration` (JSON: `{ voice, scriptHash, clips[] }`), keyed by a hash of the step script; regenerate only when content changes. Record a usage `ActivityEvent` (reuse the `BLOCK_GENERATED` metadata pattern) so voice cost shows in Settings → Usage.

### 8.4 In-player narration (replace robotic `speechSynthesis`)
In `GraphAnimationFullscreen.tsx`: keep the `Volume2/VolumeX` toggle and a11y labels; on enable, stream `/narrate` clips and play each step's clip through a shared `AudioContext`. **Sync (§3.1 segmenting):** advance to the next step only when the current clip *ends* (drive the existing timeline off the audio `ended` event, or set `stepDelay = clip.durationMs/1000`) so speech and drawing stay aligned. Auto-**signal** the active step (highlight) as its clip plays. Keep `speechSynthesis` only as a fallback if TTS fails.

### 8.5 Voice-on-video export (the shareable artifact)
Add **"Export video with voiceover"** next to the existing silent export. Extend `videoExport.ts`:
```ts
export function recordCanvasWithAudio(canvas, audioStream, mimeType, fps=30) {
  const v = canvas.captureStream(fps);
  const combined = new MediaStream([...v.getVideoTracks(), ...audioStream.getAudioTracks()]);
  const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 6_000_000 });
  /* same chunk/onstop lifecycle as recordCanvas */
}
```
Flow: build one `AudioContext` + `MediaStreamAudioDestinationNode`; reset & paint; start `recordCanvasWithAudio(canvas, dest.stream, mime)`; play each step's clip into `dest` and **advance only on `ended`** (guarantees a synced audio track); short tail; `stop()`; `downloadBlob(…-narrated.webm)`. **Weeding (§3.1):** no background music. Follow the CBE brevity guidance — keep segments short; if a diagram would exceed ~6 min narrated, the model should split steps.
- **Graceful fallback:** unsupported `MediaRecorder`/WebM (existing `pickVideoMimeType()===null`) or TTS failure ⇒ silent export + toast ("Voiceover unavailable — exported without audio"). Never block the silent path.

### 8.6 Acceptance
Human voice (not `speechSynthesis`); clips generated & played **per step**, narration starts within ~1–2s of enabling (pipelined); animation waits for each clip; "Export with voiceover" yields one WebM with a **synced audio track**; **no** voice/model picker anywhere; unchanged content re-exports from cache; failures degrade to silent; voice cost appears in Usage.

### 8.7 Files
`ai/tts.ts` (new), `api/blocks/[blockId]/narrate/route.ts` (new, streaming), `prisma/schema.prisma` (`Block.narration Json?`), `videoExport.ts`, `GraphAnimationFullscreen.tsx`, `speech.ts` (add `buildNarrationScript(forms|scene)`), optionally `MessageBubble.tsx` "Read aloud" → real TTS.

---

## 9. Production readiness (what makes it a product, not a demo)

- **Performance budgets.** Answer streaming visible < 1s; first narration audio < 2s (pipelined); diagram interaction 60fps; lazy-load the R3F engine so algebra/table answers never pay WebGL cost. Cap ops/steps (already ~10–40 ops); code-split forms.
- **Accessibility (WCAG 2.1 AA).** Keyboard for player/canvas (partly exists); focus states; captions/transcript panel for narrated video (the script *is* the transcript — expose it); color-contrast on highlights in light/dark; `prefers-reduced-motion` disables auto-draw/animation; ARIA on all controls. (Use the `design:accessibility-review` skill before handoff.)
- **States.** Every surface needs explicit loading / empty / error / offline states (chat, diagram, narration, export). Retry paths already exist for generation — extend to narration/export.
- **Correctness guardrails.** CAS verification (§7); "AI can make mistakes — check crucial steps" disclosure (peers do this) shown unobtrusively; never present an unverified answer as authoritative.
- **Cost & abuse controls.** Rate-limit generate/narrate/export per user; cache TTS + generations; the pre-existing prompt-cache-friendly system-prompt ordering (already in `prompt.ts`) stays; per-user usage caps surfaced in Settings → Usage.
- **Telemetry.** Extend `ActivityEvent` for form-kind chosen, verification corrections, narration generated, video exported (silent vs voiced), step completion — to measure learning funnel (Zeigarnik completion, replay rate) and cost.
- **Testing.** Unit: envelope parse/shim, `resolveScene`, `expr`, `toSpeechText`, CAS checks. Integration: messages & narrate streams. E2E (Playwright — Chromium is preinstalled): ask → forms render → narrate → export. Regression suite = the §5.4 list + §13.
- **Migrations & flags.** Additive Prisma migrations only; ship each pillar behind a feature flag; roll out per §11 so nothing big-bangs.
- **Security/privacy.** Keep `canvasAccessWhere` on every new route; never expose the API key client-side; narration audio served via the app, not third-party hotlinks.

---

## 10. Data model changes (Prisma — additive only)
- `Message.solution Json?`, `Message.finalAnswer String?` — persist structured steps (else they vanish on reload).
- `Message.forms Json?` **or** reuse per-form persistence: geometry/plot forms continue as connected GRAPH blocks (existing `syncGraphNode`); inline forms (steps/table/prose) persist on the assistant `Message`.
- `Block.narration Json?` — cached per-step TTS clips `{ voice, scriptHash, clips:[{step,audioUrl|dataUrl,durationMs}] }`.
- No change to `BlockKind` required (inline forms live on the message; geometry/plot reuse GRAPH). Add a new kind only if you later want a standalone interactive plot node.

---

## 11. Phased rollout (each phase shippable behind a flag)
- **P0 — TTS spike (½ day).** Prove `hackAi.replicate.tts.speechTurbo` end-to-end; confirm input fields at `ai.hackclub.com/replicate`; normalize output to a playable clip. De-risks §8.
- **P1 — Form architecture + `solution_steps`/`table` (core).** Envelope `forms[]` + back-compat shim (§5.4 regression suite green), prompt Form menu, DOM renderers, persistence. Ships §6 + most of §7.
- **P2 — Correctness self-check / CAS.** §7.4. Turns 24→72 reliably.
- **P3 — Per-step narration in player.** `tts.ts`, streaming `/narrate`, cache, audio-synced playback + auto-signal. Ships §8.3–8.4.
- **P4 — Voice-on-video export.** `recordCanvasWithAudio`, "Export with voiceover", transcript panel, graceful fallback. Ships §8.5.
- **P5 — Psychology/UX layer.** Progress/closure cues, active-recall checkpoint at step boundaries, conversational narration polish, peak-end final-answer reveal, opt-outs. Ships §3.1–3.3 surface work.
- **P6 — Production hardening.** A11y pass, perf budgets, telemetry, rate limits, tests, docs.

---

## 12. Global acceptance criteria
- AC1. All §5.4 items pass unchanged (regression suite green).
- AC2. Linear equation → algebra steps, **no diagram**; graph problem → correct plot; enumeration → table; centroid → reasoning steps (+ optional secondary figure).
- AC3. North-star (§13) returns **72** with 3 justified, "Why?"-expandable steps; persists across reload.
- AC4. Narration is a human voice, **generated per step, pipelined** (first audio < ~2s), synced to the animation, with the active step auto-signaled.
- AC5. "Export video with voiceover" → one WebM with a synced narration track; silent export still works; failures degrade gracefully.
- AC6. **No** TTS voice/model selector anywhere; model is a constant.
- AC7. CAS/self-check corrects a deliberately tricky answer instead of shipping it wrong.
- AC8. A11y: keyboard-navigable, reduced-motion honored, narrated video has a transcript; AA contrast in both themes.
- AC9. Cost controls live: TTS + generations cached; per-user rate limits; usage (incl. voice) visible.
- AC10. Any engagement/gamification element has a visible opt-out and no manipulative pattern.

---

## 13. North-star acceptance test
**Input:** *"In a triangle ABC, the medians from B and C meet at G. BG = 8, CG = 6, BC = 10, find the area of ABC."*

**Must produce:** final answer **72 sq units** (pinned); a `solution_steps` form with 3 "Why?"-expandable steps (centroid 2:1 → △BGC right-angled since 8²+6²=10² so [BGC]=24 → [BGC]=⅓[ABC] so [ABC]=72); either **no diagram** or a clearly *secondary, correct* figure (never the misleading "½·8·6=24 is the answer"); per-step human narration on demand and a narrated WebM export; and a robust correct reply if the student challenges "why 3 not 6?". Ship when this + AC1–AC10 hold.

---

## 14. Sources (research behind §3)
- Effective educational videos (segmenting/signaling/weeding/modality, ≤6 min, conversational 185–254 wpm) — CBE-Life Sciences Education: https://www.lifescied.org/doi/10.1187/cbe.16-03-0125
- Cognitive Load Theory for instructional design — https://educationaltechnology.net/cognitive-load-theory-principles-learning-processes-and-implications-for-instructional-design/
- Behavioural psychology in UX (progressive disclosure, Zeigarnik, priming/framing, decoy) — https://uxplaybook.org/articles/how-to-use-behavioural-psychology-in-ux
- Cognitive psychology principles for UI/UX — https://www.uxpin.com/studio/blog/cognitive-psychology-for-ux-design/
- Duolingo gamification psychology + dark-pattern pitfalls (streaks, loss aversion, streak-freeze, white-hat) — https://www.ludaxis.io/blog/gamification-in-apps-duolingo-case-study-2026
- EdTech nudging, cognitive load & intrinsic motivation (peer-reviewed) — https://www.mdpi.com/2254-9625/15/9/179

---

## 15. Appendix — file index
**Forms/renderer:** `ai/envelope.ts`, `ai/prompt.ts`, `ai/generate.ts`, `api/blocks/[blockId]/messages/route.ts`, `components/board/forms/*` (new), `MessageBubble.tsx`, `lib/board/types.ts`, `apiMappers.ts`.
**Explanations/correctness:** `ai/envelope.ts`, `ai/prompt.ts`, `ai/generate.ts` (+ CAS/`mathjs` or sympy service), `prisma/schema.prisma`.
**Voice:** `ai/tts.ts` (new), `api/blocks/[blockId]/narrate/route.ts` (new, streaming), `videoExport.ts`, `GraphAnimationFullscreen.tsx`, `speech.ts`, `prisma/schema.prisma`.
**Copy patterns from:** `api/blocks/[blockId]/transcribe/route.ts` (Replicate proxy + output normalization), `GraphAnimationFullscreen.handleExportVideo` (recording lifecycle), the diagram sidebar `text`/"Why?" `reason` disclosure (structured-step UX), the `[[DIAGRAM]]` marker split in `MessageBubble.tsx` (interleaving prose + forms).
