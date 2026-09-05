# openmaths — PRD: User System — Usage Metering (hackai-sdk) & Notifications

| | |
|---|---|
| **Product** | openmaths — AI math explainer (canvas app on HackClub AI / `@razinmohammedpt/hackai-sdk`) |
| **Version** | 1.0 (companion to `docs/PRD-sharing-collaboration.md`) |
| **Author** | Razin (with Claude) |
| **Date** | 2026-08-20 |
| **Audience** | Claude Code (implementing agent) working in this repo |
| **Scope** | The **user system**: (A) usage & cost metering via the hackai-sdk, made correct and complete **across ownership/sharing states**, and (B) the **notification** refinements — per-canvas scoping when a canvas is open, per-canvas aggregation on the home page, and a **hover mark-read / mark-unread** system. |

> "Hack AI" here = the **HackClub AI** backend reached through `@razinmohammedpt/hackai-sdk` — the single provider for every model call (chat, TTS, Exa, embeddings). All usage/cost numbers derive from its token accounting + `models.getPricing`. Grounded in the current working tree (Claude Code has already built roles, `Notification`, `/api/notifications`, and `NotificationBell`).

---

## 1. What "user system" covers here
Two pillars that both hang off *who the user is and what canvas they're acting on*:
1. **Usage & cost** — every AI action costs real tokens; the user (and, on shared canvases, the owner) must be able to see it, and the app must control it. Must be correct whether the canvas is the user's own or shared to them as editor/viewer.
2. **Notifications** — the user must be told what happened *to them* (shares, role changes, comments, long-running results), **scoped to the right context** (this canvas vs. all canvases) and **manageable** (read / unread).

---

## 2. Current state (code-derived)

### 2.1 Usage metering (works, actor-attributed)
- **One event per billed call.** Every LLM/TTS call records an `ActivityEvent { userId, blockId, type: "BLOCK_GENERATED", metadata: { modelId, kind:"llm"|"tts", promptTokens, completionTokens, totalTokens, costUsd, estimated, formKind, verificationCorrected } }` (`messages/route.ts`, `narrate/route.ts`). Failed-then-retried attempts each record (they cost real tokens).
- **Cost source.** `generate.ts` `recordUsage()` → `hackAi.models.getPricing(modelId)` + `computeCost(pricing, usage)`. TTS (Replicate) has **no per-call pricing** → `costUsd: null`.
- **Estimate fallback.** Streaming responses that don't return a usage block are estimated at ~4 chars/token and flagged `estimated: true`.
- **Aggregation.** `getUserUsageStats(userId)` reads all of *that user's* `BLOCK_GENERATED` events and sums in JS → totals, `byModel`, recent 25 (`Settings > Usage`, `UsageStats.tsx`). Caveats surfaced: `anyEstimated` ("≈"), `anyUnknownCost` (voice excluded, total is a floor).
- **Attribution = actor-pays.** `userId` on the event is **whoever triggered the generation**, not the canvas owner. So a collaborator generating on a shared canvas accrues it to *themselves*.
- **Rate limit.** In-memory sliding window per user (`rateLimit.ts`; messages 20/5min).

### 2.2 Notifications (works, but not scoped or toggleable)
- `Notification { userId, type(CANVAS_SHARED|ROLE_CHANGED|CANVAS_UNSHARED|COMMENT_ADDED), canvasId, actorId, data, readAt }`; created via `lib/notifications.ts`.
- `GET /api/notifications` → this user's **all** notifications (take 30) + `unreadCount` (no canvas filter).
- `POST /api/notifications/read` → mark **one by id** or **ALL** read (no mark-**unread**).
- `NotificationBell.tsx` → bell + unread badge, polls 20s; **on popover open it marks everything read**; used in **both** `CanvasTopBar` (canvas page) and `app-shell` (global/home) — identically, i.e. **not context-scoped**.

### 2.3 Gaps (this PRD fills)
1. Bell shows **all** notifications everywhere — no **per-canvas scoping** when a canvas is open.
2. Home has **no per-canvas grouping** / "which canvas is this about."
3. **No mark-unread**; opening the panel nukes all unread at once (too aggressive); no per-item hover controls.
4. Usage is **actor-only** — an owner can't see cost incurred on *their* (shared) canvas; no **per-canvas** usage view; no **budgets/caps** or **live in-session** meter.
5. No **workspace/owner rollup** policy for shared canvases; no cap-driven graceful degradation.

---

## 3. Market research — how top companies meter usage (2026)

### 3.1 The industry shift & the four metering primitives
Flat-rate AI is over: GitHub Copilot, Cursor, Windsurf, OpenAI, and Anthropic all moved to **usage/token/credit metering** in 2026 ("AI credits" is now the pricing primitive). The four models (pick per audience):

| Model | Unit | Who uses it | Pros / cons for openmaths |
|---|---|---|---|
| **Token-based** | prompt+completion tokens × model price | OpenAI/Anthropic APIs; **openmaths today** | Most accurate & granular; volatile & opaque to end users |
| **Credits** | abstract unit (1 credit ≈ N tokens / a "generation") | Copilot "AI credits", many AI apps | User-friendly, hides model-price swings; needs a conversion table |
| **Request / message** | one call = one unit | Cursor "premium requests", ChatGPT caps | Simplest mental model; unfair across cheap/expensive calls |
| **Seat** | flat per member | Notion AI, Copilot base | Predictable; no cost accountability per action |
| **Hybrid** | seat + metered overage | Most team SaaS | Best for teams; more to build |

**Recommendation for openmaths:** keep **token-based truth** underneath (already built), and present it to users as **credits** (a friendly normalized unit) once there's a plan/paywall — with the raw token/cost view kept for power users and owners. Until monetization, the current token+cost dashboard is the right internal-truth layer.

### 3.2 Attribution in shared workspaces
Three patterns; ship **actor-pays with owner rollup**:
- **Actor-pays** (accountability): the person who clicked generate owns the usage. ← openmaths today; keep as the base record.
- **Owner/workspace-pays** (billing reality on team plans): roll usage up to the canvas owner or org for the invoice.
- **Org pool + per-member visibility**: a shared budget everyone draws from, with per-member breakdown.
Best practice (Stripe/m3ter/Stigg guides): **meter once at the actor with idempotency**, then **aggregate along two axes** — *by user* (accountability) and *by canvas/owner* (billing) — from the same events. openmaths already stamps both `userId` and `blockId` (→ canvas) on each event, so both rollups are one query away.

### 3.3 Metering best practices to adopt
Idempotent event capture (no double-charge on retry/replay); **near-real-time visibility** (a live in-session meter, not just a settings page); **budgets/caps with graceful degradation** (warn → soft-limit → block, never surprise-bill); **transparency** (why a call cost X, estimate vs exact); **reconcile estimates** when the provider later returns real usage.

### 3.4 Notification read/unread UX (Gmail / GitHub inbox)
- **Per-item unread state** (bold + dot), not "mark the whole panel read on open."
- **Hover reveals actions** — mark read / **mark unread** ("come back later"), open, dismiss.
- **Context scoping**: an in-context view (this canvas) vs a global inbox (home) — exactly your ask.
- Mark read **on interaction** (open/click the item), keep others unread.

---

## 4. Part A — Usage metering, perfected across sharing states

### 4.1 Attribution policy (make it explicit)
- **Base record stays actor-pays**: the `ActivityEvent.userId` remains whoever triggered the call (already correct). This is the accountability truth and what a Viewer/Editor sees as "my usage."
- **Add the canvas dimension to every usage event** so owner/canvas rollups are possible. `ActivityEvent.blockId` already links to a block → canvas; add an explicit `canvasId` to the metadata (or resolve via block) for cheap grouping.
- **Owner rollup view**: a canvas owner can see **total AI cost incurred on their canvas**, broken down **by collaborator** (actor) and by model/form. This is the "shared edit canvas" reality — an owner sharing edit access wants to know what it's costing.
- **Policy knob (future/monetization)**: a per-canvas setting `billTo: "actor" | "owner"` so a team/owner can choose to absorb collaborator usage (owner-pays) vs. each collaborator paying their own. Default **actor** (today's behavior). Enforce at the point the event is written and/or at rollup.

### 4.2 States matrix (usage × editability × canvas ownership)
| Canvas relationship | Can generate? | Usage attributed to | Sees usage where |
|---|---|---|---|
| **Own canvas** | Yes | Self | Settings > Usage (self) + per-canvas panel |
| **Shared to me — Editor** | Yes (server-gated `requireCanvasRole editor`) | **Actor (me)** by default; owner if `billTo:owner` | My Settings > Usage; owner sees it in their canvas rollup |
| **Shared to me — Commenter/Viewer** | **No** (403) — no generation, no usage | n/a | n/a |
| **Owner of a shared canvas** | Yes | Self | Own usage + **per-canvas rollup by collaborator** |

### 4.3 Robustness ("Hack AI perfectly working")
- **Idempotency**: guard against double-recording on stream retry/replay (a request id / dedupe key per generation) so a reconnect can't double-charge.
- **Reconcile estimates**: when a later exact-usage signal is available, replace the estimate (flip `estimated:false`) instead of leaving a permanent guess. At minimum, keep surfacing the estimate caveat (already done).
- **TTS unpriced**: keep counting TTS *requests* and mark cost unknown (already done); when HackClub exposes Replicate pricing, wire it into `recordUsage`.
- **Model capability + routing**: image/PDF → Gemini (`IMAGE_FILE_MODEL_ID`) is already recorded with its own model id, so the by-model breakdown stays honest; keep `modelCapabilities` in sync.

### 4.4 Budgets, caps & live meter (new)
- **Per-user (and later per-canvas/org) budget** with **warn → soft-limit → hard-stop** thresholds; on hard-stop, generation returns a clear 429/402-style message and the UI shows "you've hit your limit" with what to do — never a silent failure or surprise bill.
- **Live in-session usage indicator**: a small, always-available readout (e.g. in the top bar or near the prompt) of tokens/cost/credits used this session and remaining budget, updated as generations complete — the "near-real-time visibility" best practice. Feeds from the same events; cheap incremental client update on each `done`.
- **Rate limit stays** as the abuse backstop (already present); budgets are the *cost* control layered on top.

### 4.5 Data & queries
- Keep `ActivityEvent` as the event log; add `canvasId` to metadata (or a real column) for grouping.
- New aggregations alongside `getUserUsageStats(userId)`: `getCanvasUsageStats(canvasId)` (owner-only, grouped by actor) and a light `getUserBudgetStatus(userId)` for the live meter/caps.
- At this app's scale, in-JS aggregation is fine (as the code already notes); revisit with SQL rollups only if volume grows.

---

## 5. Part B — Notifications (per-canvas scoping, home aggregation, hover read/unread)

### 5.1 Per-canvas scoping when a canvas is open (your ask #1)
- `GET /api/notifications?canvasId=<id>` filters to that canvas; the **canvas-page bell** (`CanvasTopBar`) passes the current `canvasId` so it shows **only this canvas's** notifications and a **per-canvas unread badge**.
- The **global bell** (`app-shell`, home/dashboard) passes no filter → all canvases.
- `NotificationBell` takes an optional `canvasId` prop and threads it into the fetch + read calls.

### 5.2 Home aggregation, grouped per canvas (your ask #2)
- On the dashboard, render the inbox **grouped by canvas** ("Right Triangle Area — 2 new", "Circle Theorems — 1 new") with the actor + type per item, so every canvas is its own section rather than a flat stream. Ties into the **"Shared with me"** dashboard section from `docs/PRD-sharing-collaboration.md` §6 (badge + granter + role on each shared canvas card, now also showing its unread count).
- Group query: notifications ordered by canvas, then time; the API can return them grouped or the client can group by `canvasId`.

### 5.3 Hover mark-read / mark-unread (your ask #3 — the Gmail behavior)
- **Per-item unread state**: unread items are bold with a leading dot; read items are muted (the bell already styles read vs unread — extend it).
- **Hover actions**: hovering a notification reveals a small control to **toggle read/unread** (and optionally dismiss/open). Clicking the toggle flips `readAt` (set a timestamp to mark read, `null` to mark **unread**).
- **API**: extend `POST /api/notifications/read` (or add `/api/notifications/mark`) to accept `{ id, read: boolean }` — set `readAt = now` when `read:true`, `readAt = null` when `read:false`. Keep the "mark all read" affordance as an explicit button, **not** an automatic on-open side effect.
- **Stop auto-mark-all-on-open**: opening the panel should *not* clear all unread (too aggressive / Gmail doesn't). Mark an item read when the user **opens/clicks it**, or via the explicit hover toggle / "mark all read" button.
- Optimistic UI with reconcile on failure.

### 5.4 More notification types (small, high-value)
Beyond sharing events, add (reusing the same model): **generation finished** for a long/backgrounded task (so a user who navigated away is told their diagram/voice is ready), **usage-cap warnings** (§4.4: "80% of your budget used"), and **comment/@mention** (when comments ship). Each respects the same scoping + read/unread system.

### 5.5 Delivery
Polling (20s) stays for v1 (already there); factor the fetch so an SSE/websocket upgrade is a drop-in later. Ensure the poll respects the current scope (per-canvas vs global) so the badge counts match the view.

---

## 6. Acceptance criteria
- AC1. On a canvas page, the bell shows **only that canvas's** notifications and a per-canvas unread badge; on the home page it shows **all**, grouped per canvas.
- AC2. Each notification has a per-item read/unread state; **hovering reveals a mark-read/mark-unread toggle**; toggling persists (`readAt` set/`null`); opening the panel no longer marks everything read.
- AC3. Usage is recorded per billed call with correct actor attribution; a **canvas owner can see total AI cost on their shared canvas, broken down by collaborator**; Viewers/Commenters generate nothing and accrue nothing.
- AC4. A **live in-session usage meter** shows tokens/cost (or credits) used and remaining budget; hitting a **budget cap** blocks generation with a clear message (no surprise bill, no silent fail); retries never double-count (idempotent).
- AC5. TTS requests are counted with cost shown as unknown (floor), estimates are labeled, and the by-model/by-canvas breakdowns stay honest across the Gemini attachment route.
- AC6. Everything respects the sharing/role model (`resolveCanvasRole`/`requireCanvasRole`) and regresses nothing in `docs/PRD-v2-production.md` §5.4.

---

## 7. QA plan (dev/staging, guarded — extends `docs/PRD-sharing-collaboration.md` §9)
- Two users (test + razin); test shares a canvas with razin as **Editor**.
- razin generates on the shared canvas → event attributed to **razin**; **test (owner)** sees that cost in the canvas rollup grouped under razin; razin sees it in his own Settings > Usage.
- Downgrade razin to **Viewer** → generation blocked (403), no usage recorded.
- Notifications: sharing fires a notification to razin; on razin's **home** it's grouped under that canvas; opening **that canvas** shows only its notifications; hover-toggle marks one read then unread (persists across reload); "mark all read" clears the rest; opening the panel alone does **not** clear unread.
- Budget: set a low cap for the test user, generate until the warn and hard-stop thresholds fire; confirm the block message + no double-count on a mid-stream reconnect.

---

## 8. File index & sources
**Usage:** `lib/ai/usage.ts`, `lib/ai/usageStats.ts` (+ new `getCanvasUsageStats`, `getUserBudgetStatus`), `lib/ai/generate.ts` (idempotency + reconcile + write `canvasId`), `app/api/blocks/[blockId]/messages/route.ts` + `narrate/route.ts` (event `canvasId`, budget check), `lib/rateLimit.ts` (unchanged backstop), new `lib/ai/budget.ts`, `components/settings/UsageStats.tsx` + new per-canvas usage panel + a top-bar **live meter** component, `prisma/schema.prisma` (optional `UserBudget` / `canvasId` on usage metadata).
**Notifications:** `app/api/notifications/route.ts` (accept `?canvasId=`), `app/api/notifications/read/route.ts` (accept `{id, read:boolean}` incl. mark-unread), `components/board/NotificationBell.tsx` (optional `canvasId` prop, per-item hover toggle, stop auto-mark-all, grouping on home), `components/board/CanvasTopBar.tsx` (pass current canvasId) + `components/shell/app-shell.tsx` (global), `components/dashboard/CanvasList.tsx` (per-canvas grouped inbox + "Shared with me" unread counts), `lib/notifications.ts` (+ generation-finished / budget-warning creators).

**Sources (research §3):**
- The end of flat-rate AI — Copilot/Cursor/Windsurf → token billing: https://wilico.co.jp/en/blog/end-of-flat-rate-ai-github-copilot-llm-billing-shift
- AI credits as the new pricing primitive (GitHub/OpenAI/Anthropic) — UsageBox: https://usagebox.com/articles/ai-credits-new-pricing-primitive-2026
- Included vs metered — the 2026 AI pricing divide — DigitalApplied: https://www.digitalapplied.com/blog/ai-subscriptions-vs-usage-credits-openai-anthropic-2026
- Usage-based billing for AI companies — Stripe: https://stripe.com/resources/more/ai-companies-and-usage-based-billing
- Usage-based billing for AI & API products — Stigg: https://www.stigg.io/blog-posts/usage-based-billing
- Metering best practices for AI services — m3ter: https://www.m3ter.com/blog/usage-based-billing-for-ai-services
