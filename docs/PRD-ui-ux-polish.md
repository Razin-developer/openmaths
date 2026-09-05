# openmaths — PRD: UI/UX Polish, Overlay Fixes & Premium-SaaS Refinement

| | |
|---|---|
| **Product** | openmaths — AI math explainer |
| **Version** | 1.0 (companion to `docs/PRD-v2-production.md`) |
| **Author** | Razin (with Claude) |
| **Date** | 2026-08-20 |
| **Audience** | Claude Code (implementing agent) working in this repo |
| **Scope** | Frontend UI correctness + interaction polish to a premium-SaaS bar, **plus two functional fixes** (STT reliability, Gemini for attachments — §9). No backend feature work here except §9. |

> This PRD is grounded in the *actual* code — every bug below cites the real file and root cause. The two headline bugs the user reported (the `/` overlay clipping inside the node, and the model/effort "alert window") are **P0** in §3. §4–§8 are the broader "so many small UI issues" audit and the premium-SaaS upgrade. §9 adds the requested STT + Gemini fixes.

---

## 1. Objective & definition of "premium SaaS"
Make openmaths *feel* like Linear/Raycast/Vercel-tier software: overlays that never clip or feel like modals, one consistent overlay system, keyboard-navigable menus, accessible touch targets and contrast, honest loading/empty/error states, and subtle, consistent motion. **No feature regresses** — this is refinement, not a rewrite.

Guiding principles (from the psychology research in `docs/PRD-v2-production.md` §3): low cognitive load, few obvious primary actions (Hick/Fitts), match existing mental models (Jakob's law), and a polished *finish* (aesthetic-usability / peak-end).

---

## 2. Root-cause theme (read this first)
Most overlay bugs share **one root cause**: menus rendered as plain absolutely-positioned `<div>`s **inside a node**, while every node card is `overflow-hidden` (needed for rounded corners + the WebGL canvas). An absolutely-positioned child cannot escape an `overflow-hidden`/clipped ancestor, and it lives inside that node's stacking context, so it (a) gets **clipped** by the node's bounds and (b) can render **under** neighboring nodes.

**The rule for the whole app:** any floating surface (menu, popover, autocomplete, toolbar, tooltip) **must be portalled to `document.body`** and anchored to its trigger. The app already has the right tools — Radix `Popover`/`DropdownMenu`/`Dialog` (all portal), the `Command` (cmdk) primitive, and `createPortal` (used correctly in `SelectionToolbar` and `BoardCanvas` drop-hint). The bugs are the places that *didn't* use them.

---

## 3. P0 — the two reported bugs

### 3.1 The `/` (and `@`) command overlay clips inside the node
**Where:** `src/components/board/nodeTypes/PromptInput.tsx` — the `showTriggerPopover` block renders:
```tsx
<div className="absolute bottom-full left-1.5 z-20 mb-1 w-52 rounded-md border … bg-popover …">
```
This is a hand-rolled absolute div inside `QuestionNode`'s `overflow-hidden` card → **clipped at the node's top edge** (exactly the screenshot), and `z-20` is scoped to the node so it can slip under other nodes.

**Fix (portal + real menu):** replace the hand-rolled div with a portalled, anchored surface. Preferred implementation — reuse the primitives already in the codebase:
- Use Radix `Popover` (auto-portals, auto-anchors, flips to stay on-screen) as the container, anchored to the textarea via `PopoverAnchor`, opened when a `/` or `@` trigger is active.
- Put a cmdk `Command`/`CommandList`/`CommandItem` inside it (same component already used in `ModelPicker` and `CommandPalette`) so the menu is **keyboard-navigable** (↑/↓ to move, Enter to select, Esc to close) — today it's mouse-only.
- Keep the existing `matchTrigger` logic and `filteredSkills`/`filteredMentions`; just render them as `CommandItem`s and route selection to the existing `selectSkill`/`selectMention`.
- Keep `nodrag` on the surface so the canvas doesn't pan while interacting.

**Acceptance:** the `/`, `@` menu floats *above* the node, never clipped, never under other nodes; fully keyboard-navigable; closes on Esc/blur/select; works when the node is near the top of the viewport.

### 3.2 Model/effort control is a full modal ("alert window") + remove the model picker
**Where:** `src/components/board/nodeTypes/ModelEffortButton.tsx` wraps `ModelPicker` + `EffortPicker` in a centered **`Dialog`** (backdrop + `fixed top-1/2 left-1/2`) — the "alert window" the user dislikes.

**Fix:**
- Replace the `Dialog` with a **`Popover` anchored to the sliders button** (small surface, no backdrop, appears next to the control). Radix `Popover` already portals + flips.
- **Remove the model picker entirely** (per request). Delete the `ModelPicker` usage from this control (and drop the per-block model dropdown from the prompt toolbar). The account-level default model still applies, and with §9 attachments now auto-route to Gemini, per-block model choice is no longer needed.
- Keep **only** the reasoning-effort control. Note `EffortPicker.tsx` is *already* a self-contained anchored `Popover` with a Low/Med/High slider — so the simplest correct implementation is: in `PromptInput.tsx`, render the `EffortPicker` trigger directly in the toolbar (near the send button) and delete `ModelEffortButton.tsx` + `ModelPicker.tsx` (and their imports) rather than keep a wrapper.
- Optional cleanup: `/api/models` route and `ModelSettings` model dropdowns can stay for account defaults, or be simplified later — out of scope for this fix; just remove the **per-node** picker.

**Acceptance:** clicking the effort control opens a small popover *next to the button* (no full-screen modal/backdrop); there is **no model picker on the node**; changing effort still persists (existing `onReasoningEffortChange` → PATCH).

---

## 4. Overlay-system consistency (the rest of the "small UI issues")
Standardize every floating surface on the portalled Radix/cmdk system. Audit and fix:

- **All in-node menus/autocompletes** follow the §3.1 portal rule. Grep for `className="absolute` inside `nodeTypes/*` and convert any menu/popature to Radix/portal. (The `/`@ menu is the known one; verify note/link nodes' inline menus too — `NoteNode.tsx`, `WebLinkNode.tsx`.)
- **One overlay vocabulary:** transient pickers → `Popover`; action lists → `DropdownMenu`; searchable lists → `Popover`+`Command`; blocking confirms only → `Dialog`. Today the app mixes `Dialog` (ShareDropdown, ModelEffortButton), `Popover` (Effort/Model), a hand-rolled div (`/`@), and `createPortal` (SelectionToolbar). Keep `Dialog` **only** where a modal is truly warranted (Share is borderline-OK; model/effort is not).
- **Consistent motion:** all popovers already animate via `tw-animate-css` in `ui/popover.tsx` — ensure the converted `/`@ menu uses the same `PopoverContent` so motion/elevation match.
- **z-index sanity:** portalled surfaces render at `z-50` at the body level (above nodes/dock/topbar which are `z-10`). Remove ad-hoc in-node `z-20`.

---

## 5. Selection toolbar & floating positioners
**Where:** `SelectionToolbar.tsx` (portals correctly) but:
- Positions once on `mouseup` via `getBoundingClientRect` and never updates on **scroll/zoom/resize** → the toolbar drifts away from the text. **Fix:** hide on scroll/resize (or reposition), and close when the selection is lost.
- No **viewport-edge collision** handling → can render half-off-screen for selections near the top/edges. **Fix:** clamp `left`/`top` into the viewport (or use a Radix `Popover` with a virtual anchor, which flips automatically).
- **Touch:** selection toolbars are mouse-selection only. **Fix (premium):** also trigger on touch `selectionchange`, or accept as a known desktop-only affordance and document it.

`BoardCanvas.tsx` drop-hint already portals correctly — use it as the reference pattern.

---

## 6. Accessibility & touch (premium baseline — WCAG 2.1 AA)
The app leans on very small text and hover-only affordances. For a premium, accessible product:

- **Type scale:** replace pervasive `text-[10px]`/`[10.5px]`/`[11px]` with a controlled scale (min ~12px for interactive/body text; reserve 10–11px for truly secondary metadata). Files: virtually every `nodeTypes/*` and settings component.
- **Contrast:** verify `--muted-foreground` (oklch 0.5 on white / 0.63 on near-black) meets AA for the text sizes used; darken where it fails, especially the many muted 10–11px labels.
- **Touch targets:** `icon-xs`/`size-4` buttons are far below the 44px min. Provide larger hit areas (padding/hit-slop) on primary node/dock/topbar controls.
- **Hover-only actions:** `MessageBubble.tsx` action bar is `opacity-0 group-hover/message:opacity-100` — invisible on touch and to keyboard users. **Fix:** also reveal on `focus-within`, and make the buttons keyboard-focusable.
- **Reduced motion:** the auto-draw diagram animation and popover motion should honor `prefers-reduced-motion` (disable/large-shorten auto-draw; the exported/animated diagram still works via step controls). Add a `motion-reduce:` path in the engine/player.
- **Focus management:** portalled menus (once on Radix) return focus to the trigger on close automatically — verify for the converted `/`@ menu. Ensure visible focus rings on all interactive elements (use `--ring`).
- **Escape semantics:** consistent Esc-to-close/cancel everywhere (canvas title edit in `CanvasTopBar.tsx` currently has no Esc-to-cancel/revert — add it).

Run the `design:accessibility-review` skill on the canvas and settings before sign-off.

---

## 7. State, feedback & micro-interactions (the "feel")
- **Recording state (STT):** `PromptInput.tsx` turns the mic button red while recording but shows no duration/level. **Fix:** show a recording timer (and ideally a simple level meter); disable send while recording; clear affordance to cancel vs. stop. (Pairs with the STT reliability fix in §9.1.)
- **Loading states:** `ModelPicker`/skills fetch show only "No models found." Add subtle skeletons/spinners for async menus; the chat already has good skeletons/`BouncingDots` — match that quality everywhere.
- **Empty & first-run:** `BoardEmptyState.tsx` exists; ensure a polished first-run (a sample prompt, the dock shortcuts, one-line "press Q for a new block"). Dashboard `CanvasList` empty state should invite creation.
- **Error states:** standardize inline error + retry (the chat's retry pattern in `ChatThread.tsx` is the model). The transcribe path currently only toasts a generic message — see §9.1.
- **Optimistic + reconciliation:** send flow is already optimistic; keep that quality for new interactions.
- **Micro-interactions:** consistent button press feedback, node hover elevation, selection ring; standardize durations/easings as tokens so nothing feels ad-hoc.
- **Delight at the peak:** a clean final-answer reveal and a smooth narrated replay (ties to `docs/PRD-v2-production.md` §3.2 peak-end) — small, tasteful, not gamified.

---

## 8. Visual system consistency
- **Iconography semantics:** `CanvasTopBar.tsx` uses `PanelRight` for a sidebar toggle labeled "Canvases" — align icon to the panel's actual side/behavior. `ShareDropdown` trigger has `aria-label="Menu"` but shows a Share icon and only a "Share" item — label it "Share" and consider dropping the redundant one-item dropdown (open the dialog directly).
- **Monochrome + destructive:** the theme is intentional strict monochrome (`globals.css`), so `--destructive` equals the near-black foreground — destructive actions don't *read* as dangerous by color. Since deletes already go through `DeleteNodeButton` confirms, this is acceptable, but consider a single restrained danger accent for destructive confirms (premium clarity). Flag as a design decision, not a hard bug.
- **Spacing/radius rhythm:** enforce the token scale (`--radius`, spacing) consistently across nodes/popovers so corners and paddings match.
- **Dark mode:** verify highlight/hover and diagram colors in `.dark` (engine `colors.ts`) keep AA contrast.

---

## 9. Functional fixes to include (requested)

### 9.1 STT (voice input) is failing in nodes — make it work via hackai-sdk
**Where:** `src/app/api/blocks/[blockId]/transcribe/route.ts` calls `hackAi.replicate.stt.incrediblyFastWhisper({ audio: audioDataUrl })`, where the browser (`PromptInput.tsx`) records `audio/webm` (Opus) via `MediaRecorder` and sends a **base64 data URL**.

**Likely root causes (address all):**
1. **Format:** `whisper-large-v3` via `incredibly-fast-whisper` may not reliably accept **webm/opus**; prefer a widely-supported container. Record as `audio/webm` but be ready to fall back, or transcode; simplest robust path is to pass a format the model accepts (wav/mp3/m4a) or verify webm support at `https://ai.hackclub.com/replicate`.
2. **Input as data URI vs URL:** Replicate models expect the `audio` field to be a URL/file; a very large base64 data URI can fail or exceed limits. **Fix options:** (a) confirm the proxy accepts data URIs for `audio`; (b) if not, upload the blob to a temporary store and pass a URL, or send the file via the SDK's file-input path.
3. **Output normalization:** keep/extend the existing `extractText()` (handles `string | {text} | {transcription}`) and add array/`FileOutput` shapes.
4. **Error surfacing:** the route returns a 502 with the raw error and `PromptInput` shows a generic toast — **improve** to a specific, actionable message and a retry, and log the raw provider error server-side for diagnosis.

**Also try the alternative STT helper** if whisper keeps failing: `hackAi.replicate.stt.parakeetRnnt11b(...)` (`nvidia/parakeet-rnnt-1.1b`) — same `extractText` normalization. Keep it all on the **hackai-sdk** (no other provider), as requested.

**Acceptance:** recording in a node reliably returns a transcript inserted into the prompt; failures show a specific message + retry; the raw provider error is logged.

### 9.2 Route image/file (attachment) AI requests to Google Gemini
**Where:** `src/app/api/blocks/[blockId]/messages/route.ts` currently resolves the model as `block.modelId ?? (hasImage ? user.imageModelId : hasFile ? user.fileModelId : …) ?? user.defaultModelId ?? DEFAULT_MODEL_ID`, gated by `getModelCapabilities` (`src/lib/ai/modelCapabilities.ts`).

**Change:** when a request carries an **image or a file (PDF)** attachment, route it to a **Google Gemini** vision model via the same `hackAi.chat.completions.create` path (Gemini has strong vision/OCR and document understanding, improving accuracy on uploaded problems).
- Add a server constant, e.g. `IMAGE_FILE_MODEL_ID = "google/gemini-..."` in `src/lib/ai/client.ts` (confirm the exact available Gemini id via `/api/models` / `hackAi.models.list()` / `https://ai.hackclub.com`). Prefer a current Gemini Flash-class vision model for latency/cost.
- In the messages route, when `hasImage || hasFile`, set `resolvedModelId = IMAGE_FILE_MODEL_ID` (overriding the per-user image/file model), keep the `getModelCapabilities` vision/pdf guard (ensure the Gemini entry advertises `vision: true, pdf: true` in `modelCapabilities.ts`).
- Keep everything on the hackai-sdk (Gemini is reached through HackClub AI's OpenAI-compatible endpoint / model id). No per-user model picker needed (aligns with §3.2 removal).
- Since attachments are multimodal, ensure `buildUserContent`/`attachments.ts` sends the image/PDF parts in the shape the Gemini model expects (the SDK's multi-part content already supports this).

**Acceptance:** uploading an image or PDF and asking a question runs on the Gemini model (verify via the usage/`ActivityEvent` `modelId`); non-attachment requests are unaffected; capability guard still blocks unsupported combos gracefully.

---

## 10. Prioritized punch list (in order)
1. **P0** — Portal + keyboard-ify the `/`@ command menu (§3.1).
2. **P0** — Replace model/effort modal with an anchored effort **popover**; remove the model picker (§3.2).
3. **P0 (functional)** — Fix STT via hackai-sdk (§9.1); route attachments to Gemini (§9.2).
4. **P1** — Overlay-system consistency sweep + z-index cleanup (§4).
5. **P1** — Selection toolbar reposition/clamp (§5).
6. **P1** — A11y/touch: type scale, contrast, touch targets, hover→focus-within, reduced motion, Esc semantics (§6).
7. **P2** — State/feedback polish: recording timer, loading skeletons, empty/first-run, error+retry standardization (§7).
8. **P2** — Visual consistency: icon semantics, spacing/radius rhythm, dark-mode contrast, destructive treatment (§8).

Each item is independently shippable; nothing here should regress the compatibility list in `docs/PRD-v2-production.md` §5.4.

---

## 11. Acceptance criteria (global)
- AC1. No floating surface clips inside a node or renders under another node; all menus portal + flip + are keyboard-navigable.
- AC2. No full-screen modal for lightweight controls; model/effort is a small anchored popover with **no** model picker on the node.
- AC3. Voice input transcribes reliably via hackai-sdk with specific error + retry on failure.
- AC4. Image/PDF requests run on Google Gemini (verifiable in usage), with the capability guard intact.
- AC5. Interactive text ≥ ~12px, AA contrast, ≥ visible focus rings, hover actions also reachable by keyboard/focus, reduced-motion honored.
- AC6. Selection toolbar stays anchored/clamped and dismisses correctly.
- AC7. Consistent overlay motion/elevation and one overlay vocabulary across the app.
- AC8. No existing feature regresses (canvas, chat, diagram player, export, sharing, PDF, skills, @-mentions, settings).

---

## 12. File index
**P0 UI:** `nodeTypes/PromptInput.tsx` (portal `/`@ menu; render effort popover, drop model picker), delete `nodeTypes/ModelEffortButton.tsx` + `nodeTypes/ModelPicker.tsx`, reuse `nodeTypes/EffortPicker.tsx`, `ui/popover.tsx` + `ui/command.tsx` (existing primitives).
**Overlay/positioning:** `nodeTypes/SelectionToolbar.tsx`, any `nodeTypes/*` with inline `absolute` menus (`NoteNode.tsx`, `WebLinkNode.tsx`), `ui/dialog.tsx`/`ui/dropdown-menu.tsx` (keep as the standard).
**A11y/visual:** `globals.css` (type/contrast tokens), `MessageBubble.tsx` (focus-within actions), `CanvasTopBar.tsx` (Esc-to-cancel, icon semantics), engine `colors.ts` + player (reduced motion), broad `text-[10/11px]` sweep.
**Functional:** `app/api/blocks/[blockId]/transcribe/route.ts` + `PromptInput.tsx` (STT), `app/api/blocks/[blockId]/messages/route.ts` + `lib/ai/client.ts` + `lib/ai/modelCapabilities.ts` + `lib/ai/attachments.ts` (Gemini routing).

**Reference patterns already correct in the codebase:** `createPortal` in `SelectionToolbar.tsx` and `BoardCanvas.tsx` (drop-hint), Radix `Popover` in `EffortPicker.tsx`, cmdk `Command` in `ModelPicker.tsx`/`CommandPalette.tsx`, output normalization in `transcribe/route.ts`.
