# openmaths — PRD: Explainer Quality, Streaming Stability & Bug Sweep

| | |
|---|---|
| **Product** | openmaths — AI math explainer |
| **Version** | 1.0 (companion to the other `docs/PRD-*.md`) |
| **Author** | Razin (with Claude) |
| **Date** | 2026-08-20 |
| **Audience** | Claude Code (implementing agent) working in this repo |
| **Scope** | Four named defects (per-step explanations, generation-time height ballooning, answer-overwrite, TTS reading LaTeX/markdown) + a premium UX feature layer + a minor-bug sweep. Grounded in the current working tree. |

> Every issue below cites the real file and root cause (verified in code). Nothing here regresses the compatibility contract in `docs/PRD-v2-production.md` §5.4.

---

## 1. Why this matters (the "unpremium" gap)
The pieces work, but the *finish* leaks: a diagram that animates without a sentence per step, a node that lurches to full height while the AI types, an answer that visibly changes when the diagram lands, and a "human" voice that says "dollar dollar" and "hash." Each is small; together they read as a prototype, not a product. This PRD makes the explainer feel deliberate.

---

## 2. P0 — Every diagram step must carry an explanation
**Symptom.** In the fullscreen animation, many steps show only "Step N" with no sentence — the student watches lines appear with nothing telling them *why*.

**Root cause.** The DSL already supports per-step text (`step_start.description`, `write_note.text/reason`) and `GraphAnimationFullscreen`/`buildNarrationScript` read it — but the **prompt only *asks*** for it ("ALWAYS include both on step_start…"). The model frequently omits it, and there is **no validation or repair**, so `stepDescription()` returns `undefined` and the caption falls back to a bare label.

**Fix.**
1. **Enforce in the prompt (`lib/ai/prompt.ts`):** every distinct `step` MUST have either a `step_start.description` *or* a `write_note.text` — a full, specific sentence a teacher would say ("Because DE ∥ BC, ∠BAD = ∠ABC by alternate interior angles"), never a fragment.
2. **Validate + repair (server, `lib/ai/generate.ts` / a scene post-process):** after parsing, detect any step with no description/note; if found, run a **cheap repair pass** that fills the missing captions (or derive them from the aligned `solution[]` step — see §3), rather than shipping a silent step. Prefer repair over rejecting the whole answer.
3. **Align diagram steps with solution steps.** When both a `scene` and `solution[]` exist, map scene step *i* ↔ solution step *i* so each drawing step can display its `claim`/`reason`. This makes "one idea per step" real and gives narration a checked script (§5).
4. **Player fallback (`GraphAnimationFullscreen.tsx`):** if a step still lacks text, show the aligned solution step's `claim` instead of "Step N".

**Acceptance:** every step in the animation shows a real one-sentence explanation (sidebar caption + on-canvas), and the narration has a line for every step.

---

## 3. P0 — No auto-grow to max height while the AI generates
**Symptom.** As the answer streams, the question/note node **jumps taller and taller up to `MAX_NODE_HEIGHT`** — a jarring, unpremium reflow.

**Root cause.** `useAutoGrowHeight.ts` observes the content box with a `ResizeObserver` and calls `updateNode(height: min(content+chrome, maxHeight))` on **every** mutation, including each streamed token, whenever `enabled = !manuallyResized`. Streaming = continuous growth to the cap.

**Fix (stable streaming — Smashing "Designing Stable Interfaces for Streaming Content").**
- **Freeze height during generation.** While `block.status === "GENERATING"` (and while narration/stream is active), **disable auto-grow** and let the node's own internal `ScrollArea` handle overflow at a stable, comfortable height (e.g. the current height or a modest default) — the content scrolls, the frame doesn't lurch. Pass `enabled: !manuallyResized && block.status !== "GENERATING"` to `useAutoGrowHeight` in `NodeBody.tsx` (and `NoteNode.tsx`).
- **Grow once, after completion.** On `done`, do a single measured grow to fit the final content (still capped, still only-grows) so the finished answer is fully visible without a mid-stream cascade.
- **Never silently hit the cap.** When content exceeds the cap, keep the internal scroll (already present) and, optionally, a subtle "scroll for more" affordance (the `ScrollBottomFade` already exists).
- Keep the manual-resize override (a user's dragged height always wins).

**Acceptance:** during generation the node stays a stable height with internal scrolling; it grows at most once when the answer completes; a manually-resized node never auto-changes.

---

## 4. P0 — Question-node answer must not be overwritten when the diagram completes
**Symptom.** The streamed explanation in the question node is **replaced/changed the moment the connected diagram finishes**.

**Diagnosis (single-request flow).** Generation is one streamed request (`messages/route.ts`) that emits `answerMarkdown` deltas, a `status:diagram` signal, then `done` with the persisted message + `graphBlock`. Two things combine:
1. **The diagram-node swap re-splits the answer.** During streaming `getConnectedGraphBlock` returns the **placeholder** (scene `null`), so `MessageBubble` renders the full streamed text. On `done`, `NodeBody` swaps in the **real** graph (scene set) → `diagramScene` flips `null → scene` → `MessageBubble` now runs `splitAtDiagramMarker` around the `[[DIAGRAM]]` marker. The visible answer reflows (and, if the model placed the marker oddly or omitted it, can appear truncated/hidden).
2. **Streamed vs persisted mismatch.** The stream shows `answerMarkdown`; the persisted message adds `solution[]`/`finalAnswer`/`table`. If the model routed most of the explanation into `solution` and left a thin `answerMarkdown`, the `done` render looks *smaller* than what streamed — reads as "overwritten."

**Fix (make the answer stable — an invariant).**
- **The answer region must never shrink or lose content across `streaming → done` or across the placeholder→real diagram swap.** Render the answer from one stable source; when the real diagram arrives, insert the diagram card **without re-parsing/replacing** the already-shown prose.
- **Decouple the diagram card from the prose.** Instead of splitting the answer text on `[[DIAGRAM]]` only once the scene exists, render a stable "Diagram" affordance (the `DiagramDrawnCard`) at the marker position from the start (a placeholder card while generating → clickable when ready), so the text layout doesn't jump when the graph completes.
- **Guarantee a substantive `answerMarkdown`** even when `needsGraph`/`solution` are present (prompt: the prose must stand alone; §2's per-step alignment helps). Then the `done` render is a superset of the stream, never a reduction.
- **Reproduce first:** add an E2E (Chromium is preinstalled) that asks a geometry question, captures the answer text at end-of-stream and 1s after the diagram node appears, and asserts they're equal (or the later is a superset).

**Acceptance:** for a diagram-producing question, the answer text is identical (or strictly richer) before and after the diagram node finishes; no flicker, no truncation.

---

## 5. P0 — TTS must not speak LaTeX/markdown (`$$`, `#`, `**`, …)
**Symptom.** The voice reads "dollar dollar", "hash", "asterisk asterisk" and raw commands.

**Root cause (exact).** `buildNarrationScript` (`lib/board/speech.ts`) builds each step's text by **joining raw `solution.claim/detail/reason`, table cells, or scene `write_note`/`step_start` text** — all of which contain markdown + `$…$`/`$$…$$` LaTeX — and the `/narrate` route passes that **straight to `synthesizeSpeech`**. The existing `toSpeechText()` (which strips fences, `$$…$$`, `$…$`→spoken, headings, bold/italic, lists, quotes) is **only applied in the browser-`speechSynthesis` path**, never to the server TTS clips.

**Fix.**
- **Normalize every narration line before synthesis.** Run each `NarrationStep.text` through `toSpeechText()` inside `buildNarrationScript` (so both the `/narrate` server path and any client path are covered), or at minimum in the narrate route immediately before `synthesizeSpeech`. Re-hash after normalization so the cache key matches spoken text.
- **Strengthen the normalizer** (`latexToSpeech`/`toSpeechText`) for the constructs steps actually use: strip/za stray `#`, `>`, backticks, list markers, leftover `\command`, `\left`/\right`, `\begin{}`, `%`, `&`, and un-mathed `^`/`_`; convert common ops (`=` → "equals", `+`/`-`/`\times`/`\cdot`/`/`, `°`, `√`, `π`, `≤`/`≥`/`≠`, superscript ² ³) to words. Consider the mature approach: a **speech-rule engine** (MathJax SRE / `sre-latex`) for robust math-to-speech instead of only regex (sources §8).
- **Narrate the *explanation*, not the raw working.** For `solution` steps, prefer **claim + reason** (skip the LaTeX-dense `detail`) so the voice says "the area of triangle BGC is 24" rather than reading a fraction character-by-character. Keep `detail` on screen (KaTeX), out of the audio.

**Acceptance:** narration never voices `$`, `#`, `*`, `\`, `_`, `^`, braces, or backticks; equations are spoken in words; the on-screen KaTeX is unchanged.

---

## 6. New premium features (the "more features" you asked for)
- **Per-step "Explain more".** In the fullscreen player and the `SolutionSteps` view, a tiny "Explain more" on a step calls the model for a deeper micro-explanation of *that* step (uses existing chat plumbing), so a stuck student can drill in without re-asking.
- **Sync-highlight the narrated step in the answer.** As narration/animation reaches step *i*, highlight the matching `SolutionSteps` line / caption (ties to the §2 step↔solution alignment) — the "signaling" principle from `docs/PRD-v2-production.md` §3.
- **Answer "at a glance" header.** Pin the `finalAnswer` at the top of a completed answer (not only the bottom), with a one-line summary — students want the result then the path.
- **Copy/share a single step** and **"Show all working" toggle** (progressive disclosure) so the default view is calm.
- **Regenerate diagram / "redraw clearer"** action on a GRAPH node (re-runs `syncGraphNode` for that question) for when a figure comes out cramped.

---

## 7. Minor UI/UX bug sweep (this pass)
- **Placeholder→real diagram position jump:** the pending graph is added at `(x+360, y)` but `syncGraphNode` offsets real diagrams by `existingConnections.length*40`; align them so the node doesn't hop on completion (`NodeBody.tsx` / `graphSync.ts`).
- **`dropNullKeys` is top-level only** (`envelope.ts`): a `null` nested inside `scene`/`solution` still fails validation — walk recursively (or coerce known-nullable nested fields).
- **`needsGraph` now defaults `false`:** confirm genuinely-geometric answers still set it true (§2 prompt work) so shapes don't silently lose their figure.
- **Narration effect double-fire guard:** key `narratedStepRef` on `(stepPosition, clip.audioUrl)` (see `docs/PRD-fullscreen-animation-ux.md` §5) so a late-arriving clip can't replay/skip.
- **Streamed math flicker:** verify `splitStreamingMarkdown` holds back dangling `$`/`$$` so half-typed LaTeX never flashes (mostly handled — re-test with the new stable-height path).
- **Small text / contrast / touch targets / hover-only actions / reduced-motion:** apply the type-scale + a11y fixes from `docs/PRD-ui-ux-polish.md` §6 to the player and node captions (the 10–11px caption text especially).
- **Auto-scroll-to-bottom during stream** should not fight a user who scrolled up to read an earlier step (respect `showScrollToBottom`).

---

## 8. Market research — how top products do this
Sources below. Themes and what we adopt:
- **Stable streaming surfaces.** Leading AI apps deliberately **reserve space and avoid layout jumps** while tokens arrive (skeletons, fixed containers, internal scroll) rather than growing the container per token — exactly our §3 fix. (Smashing: *Designing Stable Interfaces for Streaming Content*; thefrontkit / Setproduct AI-chat-UI guides; the "scroll problem" write-up.)
- **Explain, then reveal.** Best math explainers (Photomath's "granular steps with named rules", Khan) put **a justification on every step** and let the learner expand detail — our §2 + §6. (Established in `docs/PRD-explanations-and-voice.md` §5 research.)
- **Math-to-speech is a solved craft.** Don't hand raw LaTeX to a TTS; normalize with a **speech-rule engine** (MathJax SRE) or equivalent so "a² + b² = c²" is spoken, not spelled — our §5. (MathJax speech generator; Speech-Rule-Engine `sre-latex`; Speech-to-LaTeX datasets.)

---

## 9. Acceptance criteria
- AC1. Every animation step shows a real one-sentence explanation (caption + narration line); no bare "Step N".
- AC2. During generation the node holds a stable height with internal scroll; it grows at most once on completion; manual resize always wins.
- AC3. A diagram-producing question's answer text is unchanged (or strictly richer) across streaming→done and the diagram-node arrival — no overwrite/flicker/truncation (E2E-asserted).
- AC4. TTS never voices `$ # * \ _ ^ { } \``; equations are spoken in words; on-screen KaTeX unchanged; narration cache keyed on the spoken text.
- AC5. "Explain more", step sync-highlight, pinned final answer, and "show all working" toggle ship and work.
- AC6. The §7 minor bugs are fixed; no regression to the §5.4 compatibility list.

---

## 10. File index & sources
**Change:** `lib/ai/prompt.ts` (per-step enforcement + stand-alone prose), `lib/ai/generate.ts` (scene step-caption validation/repair + step↔solution alignment), `lib/board/speech.ts` (`buildNarrationScript` → normalize via `toSpeechText`; strengthen `latexToSpeech`/consider SRE; narrate claim+reason), `app/api/blocks/[blockId]/narrate/route.ts` (normalize before synth + re-hash), `components/board/nodeTypes/useAutoGrowHeight.ts` + `NodeBody.tsx` + `NoteNode.tsx` (freeze height during generation, grow-once), `components/board/nodeTypes/MessageBubble.tsx` (stable diagram card; no re-split on graph arrival), `components/board/nodeTypes/GraphAnimationFullscreen.tsx` + `SolutionSteps.tsx` (per-step fallback, sync-highlight, "Explain more", pinned answer), `lib/ai/envelope.ts` (recursive null-drop), `lib/board/graphSync.ts` (placeholder position parity).

**Sources:**
- Designing Stable Interfaces for Streaming Content — Smashing Magazine: https://www.smashingmagazine.com/2026/05/designing-stable-interfaces-streaming-content/
- AI Chat UI best practices — thefrontkit: https://thefrontkit.com/blogs/ai-chat-ui-best-practices
- Designing AI chat interfaces (anatomy, patterns, pitfalls) — Setproduct: https://www.setproduct.com/blog/ai-chat-interface-ui-design
- The scroll problem in AI chat interfaces — Medium: https://medium.com/@disgcfrguy/the-scroll-problem-nobody-talks-about-when-building-ai-chat-interface-987c223cafc0
- MathJax → speech (LaTeX/MathML to spoken): https://mathjax.github.io/MathJax-demos-web/speech-generator/convert-with-speech.html
- Speech Rule Engine — sre-latex: https://github.com/Speech-Rule-Engine/sre-latex
- Speech-to-LaTeX (math↔speech datasets/models): https://arxiv.org/html/2508.03542v1
