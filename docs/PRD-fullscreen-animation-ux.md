# openmaths — PRD: Fullscreen Player & Animation UX (multi-form, audio sync, true-fullscreen)

| | |
|---|---|
| **Product** | openmaths — AI math explainer |
| **Version** | 1.0 (companion to `docs/PRD-v2-production.md` and `docs/PRD-ui-ux-polish.md`) |
| **Author** | Razin (with Claude) |
| **Date** | 2026-08-20 |
| **Audience** | Claude Code (implementing agent) working in this repo |
| **Scope** | The fullscreen **player/animation** experience (graph node + question node): multi-form support, animation quality (drawing speed, values/args, scrubber), audio (fix duplicate requests, preload, per-step sync), and the fullscreen/toggle UX bugs. |

> Grounded in the **current** working tree (Claude Code has already built narration — `lib/ai/tts.ts`, the streaming `/narrate` route, and the narration UI in `GraphAnimationFullscreen.tsx`). This PRD fixes and finishes that, and covers every point raised. Cross-refs to the other two PRDs where relevant; nothing here regresses the compatibility contract in `docs/PRD-v2-production.md` §5.4.

---

## 1. Current state — what the player is and what it accepts today

### 1.1 The three fullscreen surfaces (and their inconsistency — a root UX bug)
- **`GraphAnimationFullscreen.tsx`** (graph node) — **true edge-to-edge** (`fixed inset-0 h-screen w-screen`). Has the animation, step sidebar, per-step caption, narration (real TTS), transcript panel, video export + voiceover export. **Geometry-only.**
- **`NodeFullscreen.tsx`** (question node) — **NOT fullscreen**: a centered dialog `h-[85vh] w-[90vw] max-w-3xl`, `showCloseButton={false}`, no close button in its header. **This is exactly the screenshot** — it looks like a floating card, not fullscreen.
- **`NoteFullscreen.tsx`** (note node) — true edge-to-edge (`fixed inset-0`), has its own explicit `X` close button.
- (`WebBrowserFullscreen.tsx` — audit for the same inconsistencies.)

**Root issue:** "fullscreen" means three different things across node types, and only some have a close affordance. This is the source of "the fullscreen btns on some nodes don't work reversibly" (§6).

### 1.2 Which op *types* the animation engine accepts today (you asked)
`SceneInterpreter.tsx` renders a **geometry `Scene`** (a flat op list). Currently accepted op types:

**Drawn:** `draw_line`, `draw_polygon`, `draw_circle`, `draw_arc`, `draw_ray`, `draw_vector`, `draw_dashed_line`, `draw_point`, `draw_tick_marks`, `draw_right_angle_mark`, `draw_parallel_marks`, `draw_ellipse`, `draw_parabola`, `draw_function`, `draw_bezier`, `draw_grid`, `draw_axes`, `shade_region`, `draw_bracket`, `draw_curved_arrow`, `draw_cuboid`, `draw_cylinder`, `draw_cone`, `draw_sphere_outline`, `draw_regular_polygon`, `place_text`, `label_angle`, `label_side`.
**Silent/structural:** `move_cursor`, `write_note` (+`reason`), `step_start`/`step_end` (title/description).
**Scene-level:** `variables` + `bindings` (parametric sliders), `boundingBox`.

**What it does NOT accept today (the gap):** the **other forms** from `docs/PRD-v2-production.md` §5 — `solution_steps` (algebra/reasoning), `table`/`matrix`, and `plot` as a first-class narrated form. The player is geometry-only, and the `/narrate` route hard-rejects any non-GRAPH block (`"Only GRAPH blocks can be narrated"`). **Feature A (§3) fixes this.**

### 1.3 Current audio behavior (and its bugs)
- `toggleNarrate()` streams `/narrate` (NDJSON, one clip per step) and stores clips in **local component state**; audio-gated sync pauses the timeline, plays the clip, advances on `onended`.
- **Bug 1 — duplicate audio requests:** the only guard is `if (narrationClips.some(Boolean)) return;`. There is **no in-flight guard**, so a double-click, or toggling off→on before clips arrive, or the voiceover-export path (`handleExportVideoWithVoice` re-streams if `!clips.some(Boolean)`) can fire **multiple concurrent `/narrate` POSTs** — each one re-synthesizes every step (real Replicate cost) because the server only writes its cache **after** all clips finish. (§5.1)
- **Bug 2 — no preload:** clips are fetched only when the user toggles narration **inside** the already-open fullscreen, and live in local state that is **lost on unmount/remount**. There's no client preload before opening, and the persisted `block.narration` cache is never hydrated on open. (§5.2)
- **Bug 3 — draw/voice not co-timed:** drawing and narration run **sequentially** per step (draw → then speak over a static frame), not co-animated; drawing speed is unrelated to clip length. (§4/§5.3)

---

## 2. Market research → what a premium math-animation player does
Sources (§9): NN/g instructional-video guidelines, Mux/Vidzflow/Eleken player-UX guides, and Manim/LLM2Manim pedagogy-aware animation practice.

- **User control is non-negotiable.** Learners scrub, rewind, and skip constantly. A real **scrubber/progress bar with chapter (step) markers**, click-to-seek, current-time/'`Step x/N`', and hover preview beats "play/pause + prev/next" alone. (We have prev/next/scrub-by-step; we lack a continuous timeline.)
- **Playback speed presets** (0.5×/1×/1.5×/2×) are expected. (We have a "step duration" multiplier — reframe it as familiar speed presets + a fine slider.)
- **Captions/transcript** are table stakes for a11y and silent viewing. (We have a transcript panel — good; wire it to auto-scroll + click-to-seek a step.)
- **Segmenting / chaptering** (one idea per step, ≤~6 min total) matches our step model — surface steps as named chapters on the scrubber.
- **Sync visuals to narration (Manim `run_time`).** The single biggest quality lever: each step's **drawing duration should match its narration clip length** (and use easing), so the figure draws *while* the voice explains it and they finish together — not draw-then-talk. (§4.3/§5.3)
- **Keyboard + focus.** Space, ←/→, Home/End, F for fullscreen, C for captions — power-user expectation. (We have Space/←/→/Esc; extend.)
- **Loop/replay + "restart step"** for study. Replaying a hard step is the most common instructional-video behavior.

---

## 3. Feature A — Multi-form fullscreen player
Extend the fullscreen from geometry-only to a **form-aware "explainer"** matching `docs/PRD-v2-production.md` §5 forms:

- **Geometry / plot / number_line** → the existing WebGL `BlockCanvas` path (unchanged).
- **`solution_steps` (algebra/reasoning)** → a fullscreen **stepped reader**: each step is a "chapter" that reveals its KaTeX line + "Why?", advanced by the same timeline/step controls, narratable by the same per-step audio model. No WebGL needed.
- **`table`/`matrix`** → a fullscreen table view with per-row/section reveal + narration.
- **Unify the player shell:** one `FullscreenPlayer` that takes an ordered list of "steps" (from whichever form) and provides the shared chrome — scrubber, play/pause, speed, narration, transcript, export (export only where a canvas exists). The geometry renderer becomes one step-source among several.
- **Lift the `/narrate` restriction:** allow narrating any narratable form (solution steps, table), not only GRAPH blocks — recompute the script from the form's step text (`buildNarrationScript` already accepts a `solution`).

**Acceptance:** opening fullscreen on an algebra-steps answer plays a narrated, stepped reader (no diagram); a table answer reveals row-by-row with narration; geometry is unchanged.

---

## 4. Feature B — Better animation, values & args
### 4.1 A real timeline scrubber
Add a continuous progress bar under the canvas with **step/chapter markers**, click/drag-to-seek (map x→op index via `buildStepIndex`/`firstOpIndexByStep`), current position, and hover-scrub preview. Keep prev/next as secondary. This replaces the current "Step x/N" text-only affordance.

### 4.2 Playback speed as presets + easing
Reframe the "step duration ×" slider as **0.5× / 1× / 1.5× / 2×** chips plus a fine slider; apply an ease-in-out `rate_func` to op drawing (engine `timelineUtils`/tick) so lines draw with natural acceleration instead of linear, and add a subtle draw-on cursor emphasis (the `AiCursor` already exists — tune its easing).

### 4.3 Sync drawing speed to narration (per-step `run_time`)
When narration is on, set each step's **draw duration = its clip duration** (compute clip `durationMs` — decode the audio, or read it from the `<audio>` metadata / an `AudioBuffer`), so the figure animates *while* the voice speaks and both finish together (Manim `run_time`). When narration is off, use the base per-op durations. Implement by scaling the step's op durations to the target (extend `getOpDurations`/`tick` to accept a per-step target, or set `speed`/hold so the step spans the clip). (§5.3 is the audio side of this.)

### 4.4 Values & args panel
For parametric scenes (`variables`/`bindings`) and computed quantities, add a compact **"Values" panel**: show each variable's current value (already have sliders) **plus** the live computed results (evaluate `bindings` expressions for display), and, where the scene exposes them, the **arguments** that produced the figure (given lengths/angles). Animate value changes (count-up/interpolate) as a slider moves or a step reveals a new value — this makes the "args → result" relationship legible, which is the pedagogical point.

### 4.5 Polish
Loop toggle, "restart this step", Home/End/F/C keyboard shortcuts, reduced-motion path (honor `prefers-reduced-motion`: jump-reveal instead of animate), and consistent motion with the rest of the app.

---

## 5. Feature C — Audio: fix duplicate requests, preload, sync
### 5.1 Fix the multiple-request bug (required)
- **Client:** add an **in-flight guard** — a `narrationPromiseRef` (or a shared store flag) so only one `/narrate` request per block can run; every caller (`toggleNarrate`, voiceover export, preload) awaits the *same* promise instead of starting a new stream. Guard on "loading OR loaded", not just "loaded".
- **Move clips to a shared store** (e.g. a `narrationStore` keyed by blockId, or reuse a store) so the player, the export, and preload share one copy that survives unmount/remount — no refetch on reopen.
- **Server:** make `/narrate` **cache-first and idempotent** — it already writes `block.narration` after synthesis and streams cached clips on a hit; add a lightweight in-process lock (or an advisory DB flag) so two concurrent requests for the same block+scriptHash don't both synthesize. On any hit, stream the cache (already implemented) — the client dedupe above is the primary fix.

**Acceptance:** toggling narration on/off rapidly, or exporting-with-voice right after enabling narration, results in **exactly one** synthesis pass per unique scene (verify: one set of `BLOCK_GENERATED kind:"tts"` events; no duplicate Replicate calls).

### 5.2 Preload audio on the client before fullscreen opens (required)
- **Hydrate from cache instantly:** when a GRAPH (or narratable) node mounts/becomes ready, if `block.narration` exists and matches the current scene hash, load those clips into the shared store immediately — zero network, instant narration.
- **Warm prefetch:** kick off the `/narrate` stream **when the user signals intent** — on hover/focus of the node's Fullscreen/Play (`Film`/`Expand`) button, or when the node enters view — not only after opening. Store clips in the shared store.
- **Preload the audio bytes:** for streamed clip URLs, create `Audio()` elements (or decode to `AudioBuffer`) ahead of time so the first `play()` is instant, no buffering gap. Respect a small concurrency cap.
- Net effect: by the time the user opens fullscreen and hits narrate, step 0 plays with no visible wait.

### 5.3 Per-step audio↔drawing sync (finish the job)
Replace the current draw-then-speak sequencing with **co-timed** playback (§4.3): start the step's draw animation and its narration clip together; hold the step until **both** finish (`Promise.all([drawDone, clipEnded])`); then advance. The voiceover-export path (`handleExportVideoWithVoice`) already does a `Promise.all([drawDone, clip duration])` — bring the **live player** to the same model so on-screen playback matches the exported video. Keep the audio-gated "don't free-run the timer" behavior.

---

## 6. Fullscreen & toggle UX fixes (the reported bugs)
### 6.1 Make the question-node fullscreen actually fullscreen + a windowed↔fullscreen toggle
- `NodeFullscreen.tsx` currently renders a centered `max-w-3xl` dialog. Add a **"true fullscreen" mode** (`fixed inset-0 h-screen w-screen`, like `GraphAnimationFullscreen`/`NoteFullscreen`) and a **toggle button in the header** that switches windowed ↔ edge-to-edge (icons: `Maximize`/`Minimize2`). Persist the choice per session.
- Add a real **close (`X`) button** to `NodeFullscreen` (it currently has `showCloseButton={false}` and no header close) so exiting is obvious — matching `NoteFullscreen`'s explicit `X`.

### 6.2 Make every "fullscreen" button reversible (the "doesn't work reversibly" bug)
- Root cause: header/graph buttons call `setFullscreen(id, true)` (always open, never toggle). In fullscreen, clicking the same button is a no-op → feels broken.
- Fix: make it a **toggle** — `setFullscreen(id, !current)` — and reflect state in the icon/label (`Expand` ↔ `Minimize`/`Shrink`), across `NodeHeader.tsx` (question), `GraphNode.tsx` (the `Film` **and** `Expand` buttons — dedupe these two into one clear "Play fullscreen" control), and any other node with a fullscreen trigger. Ensure Esc, the `X`, backdrop click, and the toggle button **all** exit consistently.
- Audit `WebBrowserFullscreen.tsx` and `NoteFullscreen` for the same pattern.

### 6.3 One consistent fullscreen contract
Define shared behavior for all fullscreen surfaces: edge-to-edge by default (question node gets the windowed↔full toggle), always a visible close + Esc, a labeled title, focus trapped and returned to the trigger on close, and (§4) the same player chrome where a timeline applies.

---

## 7. Other player/UX issues found (fix in this pass)
- **Narration effect keys on `timeline.currentStepPosition` + `narrationClips` only** (eslint-disabled deps) — verify it can't double-fire a clip or skip one when clips arrive out of order; the `narratedStepRef` guard helps but should key on a stable `(blockId, stepPosition, clip.audioUrl)` tuple.
- **Transcript panel** doesn't auto-scroll to the active line or let you click a line to seek — wire both (§2 captions).
- **Export buttons** (`VideoIcon` silent, `Mic` voiceover) are two unlabeled icons crammed in the control row — group them under one "Export ▾" with clear labels ("Video", "Video + voiceover"), and disable/tooltip the voiceover option when `TTS_PROVIDER==="webapi"` (already tooltipped — make it a proper disabled+reason state).
- **Loading state:** `narrationLoading` shows a spinner on the narrate button — good; also show a subtle "Generating voice… step x/N" while the stream fills, since later steps synthesize after playback starts.
- **`Settings2` popover** duplicates info (keyboard hints) that belongs in a `?`/shortcuts affordance — tidy.
- **Small text everywhere** (`text-[10.5px]/[11px]`) — apply the type-scale/contrast fixes from `docs/PRD-ui-ux-polish.md` §6 to the player too.
- **Reduced motion** not honored in the player — add it (§4.5).
- **Mount cap interaction:** `boardUiStore` caps mounted WebGL diagrams at 6; ensure opening fullscreen for a node whose preview was unmounted still mounts the canvas correctly (verify `getCanvasEl(blockId)` is non-null before export — it already guards, but preload/export should surface a clear message if the canvas isn't mounted).

---

## 8. Acceptance criteria
- AC1. Question-node fullscreen has a **true edge-to-edge mode** with a windowed↔fullscreen **toggle** and a visible close; matches `NoteFullscreen`/`GraphAnimationFullscreen` behavior.
- AC2. Every fullscreen trigger is a **reversible toggle** with state-correct icon/label; Esc / X / backdrop / toggle all exit; no dead-click.
- AC3. Enabling narration or exporting-with-voice triggers **exactly one** synthesis pass per unique scene (no duplicate `/narrate` requests / Replicate calls); clips survive reopen via the shared store + `block.narration` cache.
- AC4. Narration audio is **preloaded** (cache-hydrate on mount + warm prefetch on intent + audio bytes buffered) so step 0 plays with no visible wait after opening fullscreen.
- AC5. Each step's **drawing is co-timed with its narration** (draw while speaking, finish together) in both the live player and the exported voiceover video.
- AC6. The player has a **scrubber with step/chapter markers**, click-to-seek, **speed presets**, transcript with click-to-seek + auto-scroll, loop/restart-step, and extended keyboard shortcuts.
- AC7. The fullscreen player supports **multiple forms** (geometry/plot, algebra `solution_steps`, table) with the same chrome; `/narrate` works for narratable non-geometry forms.
- AC8. A **Values/args panel** shows current variable values + live computed results, animating on change.
- AC9. No regression to existing export, parametric sliders, step sidebar, hover-highlight, or the compatibility list in `docs/PRD-v2-production.md` §5.4; reduced-motion honored.

---

## 9. File index & sources
**Player/animation:** `nodeTypes/GraphAnimationFullscreen.tsx` (→ generalize into a shared `FullscreenPlayer`), `nodeTypes/NodeFullscreen.tsx`, `nodeTypes/NoteFullscreen.tsx`, `nodeTypes/WebBrowserFullscreen.tsx`, `nodeTypes/NodeHeader.tsx`, `nodeTypes/GraphNode.tsx`, `store/boardUiStore.ts` (add `fullscreenMode: "windowed"|"full"`), `components/engine/{useSceneTimeline,timelineUtils,SceneInterpreter,AiCursor}.tsx` (easing, per-step run_time), `store/blockStore.ts` (per-step target duration).
**Audio:** `lib/ai/tts.ts`, `app/api/blocks/[blockId]/narrate/route.ts` (idempotent/lock), new `store/narrationStore.ts` (shared clips + in-flight guard + preload), `lib/board/videoExport.ts` (already has `recordCanvasWithAudio`/`fetchAudioBuffer`), `lib/board/speech.ts` (`buildNarrationScript`/`hashScript`).
**Forms:** `lib/ai/envelope.ts` (forms — see `docs/PRD-v2-production.md` §5), `components/board/forms/*`.

**Sources (research §2):**
- NN/g — Instructional video UX guidelines: https://www.nngroup.com/articles/instructional-video-guidelines/
- Mux — Best practices for video playback (2025): https://www.mux.com/articles/best-practices-for-video-playback-a-complete-guide-2025
- Eleken — Video player UI patterns & UX: https://www.eleken.co/blog-posts/video-player-ui
- Vidzflow — Custom video player UI, performance & accessibility: https://www.vidzflow.com/blog/designing-a-custom-video-player-ui-tips-for-performance-and-accessibility
- LLM2Manim — pedagogy-aware AI generation of STEM animations: https://arxiv.org/html/2604.05266
- Manim CE (run_time / rate_func / animation timing reference): https://manim.varunrao.com/
