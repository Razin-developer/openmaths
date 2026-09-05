# openmaths — PRD: Performance Audit & Answer-Rendering Fix

| | |
|---|---|
| **Product** | openmaths — AI math explainer (Next.js 16 · React 19 · Prisma/pg · @xyflow/react · three.js/R3F) |
| **Version** | 1.0 |
| **Author** | Razin (with Claude) |
| **Date** | 2026-08-20 |
| **Audience** | Claude Code (implementing agent) |
| **Scope** | (A) Fix the **answer-overwrite** — the streamed prose answer being replaced by the collapsed step view when the diagram lands. (B) A **full performance audit** — what actually makes the app lag (DB, rendering, WebGL, re-renders, latency, dev-mode), with an instrumentation plan to capture real metrics. |

> Grounded in the current code (file + line cited per finding). I could not profile your live `localhost:3000` from here (the device shell has no network path to the host dev server, and browser profiling needs your login) — so this is a code-level audit plus the exact tooling to get real numbers (§4). Fix the P0 DB item first; it likely explains most of the lag.

---

## PART A — Answer-rendering: stop overwriting the streamed answer

### A1. The exact bug (your repro)
While generating, the node streams a clean prose derivation ("…using the Pythagorean theorem … c = √100 = 10 … Drawing diagram…"). The moment generation finishes, that prose is **replaced** by a terse structured view: `Answer: 10`, four numbered steps with collapsed "Why?", a "Diagram drawn" card, and a **"Show full explanation"** toggle — i.e. **the answer the user just watched stream is now hidden** behind a disclosure.

### A2. Root cause (confirmed in `MessageBubble.tsx`)
On completion, `hasSolution = !isStreaming && message.solution?.length > 0` switches the render **from the streamed `answerMarkdown` prose to `<SolutionSteps>`**, and the original prose (`fullMarkerStripped`) is only shown if the user clicks **"Show full explanation"** (`showFullExplanation`, default false). So streaming renders one thing (prose) and the finalized message renders a different thing (steps) — a hard swap that discards what the user was reading. (The diagram-marker split was already stabilized in a prior pass; this prose→steps swap is the remaining, and more jarring, overwrite.)

### A3. Fix — keep the structured process, and append the full explanation at the bottom (shown by default)
Chosen design: **keep the premium structured step-by-step process, but don't hide the prose the user watched stream — render the full prose explanation at the bottom, after everything, visible by default.** The invariant (`docs/PRD-explainer-quality-and-bugfixes.md` §4) still holds: nothing on screen at end-of-stream disappears on completion.

Concrete render order for a completed assistant message (`MessageBubble.tsx`, `hasSolution` branch):
1. **Pinned answer** — `finalAnswer` chip (top), so the result is scannable first.
2. **Process** — the numbered `SolutionSteps` (claim / working / "Why?"), the premium structured view.
3. **Table** — `TableForm`, when present.
4. **Diagram card** — the stable "Diagram drawn" slot (already stabilized).
5. **Full explanation** — the streamed prose (`fullMarkerStripped`), rendered **at the bottom, after everything, and expanded by default** — under a light "Explanation" heading/divider. This is the exact text the user watched stream, so it is never lost.

Implementation change: flip the current `showFullExplanation` default from **collapsed → expanded** and **move the prose block to the very bottom** (after the diagram card), so the flow is *answer → steps → diagram → full written explanation*. Keep a **"Hide explanation"** toggle for users who want the compact view, but the default is **shown** — the streamed prose is never hidden behind a click on completion. (Optional polish: remember the user's collapse preference per session via the boardUiStore, not localStorage in-canvas.)

### A4. Acceptance (Part A)
- On completion the message shows, in order: pinned `finalAnswer` → structured steps → table (if any) → diagram card → **full prose explanation at the bottom, expanded by default**.
- The prose visible at end-of-stream is still visible after completion — never hidden behind a collapsed toggle (a "Hide explanation" toggle may exist, but default is shown).
- No layout swap/flicker or content loss when the message finalizes or the diagram node connects (E2E: capture the answer text at end-of-stream and 1s after diagram-ready; assert the full prose is still present).

---

## PART B — Performance audit

### B0. Measure the right build first
You're running `next dev` on :3000. **Dev mode is not representative** — it compiles routes on navigation, double-renders (StrictMode), ships unminified code with source maps, and runs HMR. **Before diagnosing, benchmark a production build**: `pnpm build && pnpm start`. A large share of perceived lag is usually `next dev`. Keep dev-mode findings separate from prod-mode ones.

### B1. 🔴 P0 — Database is capped at ONE connection (serializes everything)
`src/lib/prisma.ts`:
```ts
const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL, max: 1 }));
```
The pg pool `max: 1` means **the entire app runs at most one DB query at a time** — every other query queues behind it. The canvas page issues many queries (all blocks + all messages), and generation does several sequential lookups (context, ancestors, connections, diagram sync); with `max:1` none of it can parallelize, and concurrent users/requests block each other. `DATABASE_URL` even sets `connection_limit=10`, but the adapter's `Pool(max:1)` overrides it. **This is the most likely single cause of the lag.**
**Fix:** raise the pool `max` (e.g. 10–20, matching `connection_limit`); confirm the pooled Postgres tolerates it. Re-measure query concurrency after.

### B2. 🔴 P0 — No viewport culling: every node renders (incl. WebGL + KaTeX) even off-screen
`BoardCanvas.tsx` `<ReactFlow>` does **not** set `onlyRenderVisibleElements`. With the ~10+ diagram nodes in your screenshots, **every** node mounts — each GRAPH node a full three.js `<Canvas>` (WebGL context) and each QUESTION node a ReactMarkdown+KaTeX chat — regardless of whether it's in the viewport.
**Fix:** set `onlyRenderVisibleElements` (React Flow's built-in culling), memoize custom node components with `React.memo` (none currently are — `grep` found no `memo` in `nodeTypes/`), and avoid inline object/array props into `<ReactFlow>`.

### B3. 🔴 P0 — One WebGL context per diagram (the many-canvas anti-pattern)
Each GRAPH node mounts its own three.js renderer via `BlockCanvas`. Even with `boardUiStore`'s 6-context cap (`MAX_MOUNTED_DIAGRAMS`), 6 live WebGL contexts + the fullscreen one is heavy; browsers hard-limit ~8–16 contexts and thrash near it. Live mode uses `frameloop="always"` (continuous rAF) and `preserveDrawingBuffer: true` (needed for export, but disables GPU optimizations and inflates memory) — **verify current values**, they were set this way when last read.
**Fix (how Figma/Miro/tldraw scale — §5):** don't render a live WebGL canvas per node. Render **static previews as rasterized images/SVG** (draw once, snapshot to a `<canvas>`/`<img>`) and only spin up the live WebGL renderer for the **one** node being animated/fullscreened. Use `frameloop="demand"` + `invalidate()` for any on-canvas preview; drop `preserveDrawingBuffer` except during export; unmount contexts for off-screen nodes (pairs with B2).

### B4. 🟠 P1 — Streaming re-renders + auto-grow layout thrash
Each streamed token → `streamingStore.appendDelta` → `NodeBody`/`ChatThread` re-render → **ReactMarkdown re-parses the entire growing answer every token** (roughly O(n²) over the stream) → and `useAutoGrowHeight`'s ResizeObserver fires → `updateNode(height)` → React Flow re-layouts the node. That's a heavy per-token cost and visible height thrash.
**Fix:** batch delta flushes (coalesce tokens to ~1 rAF / 30–50 ms) instead of per-token; memoize the streamed markdown; and **freeze auto-grow during `GENERATING`** (already specced in `docs/PRD-explainer-quality-and-bugfixes.md` §3) so streaming doesn't drive layout. Consider an incremental/streaming markdown renderer.

### B5. 🟠 P1 — No code-splitting; heavy client bundle
`grep` found **no `next/dynamic`** anywhere. three.js + `@react-three/fiber` + `@react-three/drei` + `@xyflow/react` + `katex` all load up front → large JS to download, parse, and hydrate on the board route (slow first interaction, especially on mid-range devices). (`@react-pdf/renderer` is used server-side in the export route — keep it off the client.)
**Fix:** `next/dynamic` (ssr:false) the R3F engine so a canvas loads only when a diagram is shown; split the fullscreen player; lazy-load KaTeX where possible; run `@next/bundle-analyzer` to find the rest. Verify `@react-pdf/renderer` never enters a client bundle.

### B6. 🟠 P1 — Per-frame store writes during animation
`TimelineTicker` calls `tick()` (a zustand `set`) **every frame** while a diagram plays; every component subscribed to that block's playback state re-renders each frame. Fine for one small diagram, costly if selectors are broad or multiple diagrams animate.
**Fix:** ensure `SceneInterpreter`/subscribers use **narrow selectors** (subscribe only to `currentOpIndex`/`opProgress`, not the whole block state), throttle non-essential subscribers, and keep the ticking canvas on `demand` when paused.

### B7. 🟡 P2 — N+1 / unbounded DB query patterns
- `buildGenerationContext` and `getInheritedWebLinks` walk the ancestor chain with **one query per ancestor** (loop of `findUnique`) → several serial round-trips per generation (amplified by B1's max:1).
- The canvas page loads **all blocks + all messages** in one shot (large payload + hydration) with no pagination.
- `getUserUsageStats` fetches **every** `BLOCK_GENERATED` event and sums in JS — grows unbounded; the Usage page slows over time.
**Fix:** batch ancestor lookups (single `IN` query or a recursive CTE), paginate/lazy-load canvas blocks and messages, and move usage aggregation to a SQL `GROUP BY` (or a periodic rollup) once volume grows.

### B8. 🟡 P2 — Generation latency (serial external calls + verification pass)
The messages route runs, in sequence: site-restricted Exa (loop ≤3), open web-search Exa, the LLM generation, a **verification pass** (extra LLM call), then graph-sync + weblink-sync. That's a long serial chain → slow time-to-answer (distinct from UI lag, but felt as "slow").
**Fix:** parallelize independent steps (the Exa searches, the syncs), gate the verification pass by complexity (already partially), and stream first-token as early as possible (already streams). Add Server-Timing so each phase's cost is visible.

### B9. Summary table
| # | Sev | Finding | Location |
|---|---|---|---|
| B1 | 🔴 P0 | DB pool `max: 1` — all queries serialize | `lib/prisma.ts` |
| B2 | 🔴 P0 | No `onlyRenderVisibleElements`; nodes not memoized | `BoardCanvas.tsx`, `nodeTypes/*` |
| B3 | 🔴 P0 | One WebGL context per diagram; always-on frameloop | `BlockCanvas.tsx`, `boardUiStore` |
| B4 | 🟠 P1 | Per-token markdown re-parse + auto-grow layout thrash | `NodeBody`, `MessageBubble`, `useAutoGrowHeight` |
| B5 | 🟠 P1 | No code-splitting; heavy three/drei/xyflow/katex bundle | app-wide (no `next/dynamic`) |
| B6 | 🟠 P1 | Per-frame zustand writes re-render subscribers | `TimelineTicker`, `SceneInterpreter` |
| B7 | 🟡 P2 | N+1 ancestor queries; unbounded canvas/usage loads | `context.ts`, `webLinkSync.ts`, `usageStats.ts`, canvas page |
| B8 | 🟡 P2 | Serial external calls + verification pass → answer latency | `messages/route.ts` |
| B0 | — | Measure a **prod build**, not `next dev` | — |

---

## 4. Instrumentation plan — get real metrics (you asked "use a lib")
Add these to actually locate the bottleneck rather than guess:
- **Web Vitals (the lag metric is INP):** `web-vitals` + `useReportWebVitals` (Next.js built-in) → log LCP, **INP**, CLS, TTFB. INP > 200ms is the "feels laggy" signal.
- **React render profiling:** **`react-scan`** (highlights what re-renders and how often) and/or React DevTools **Profiler** — find the components re-rendering per token/frame (expect `MessageBubble`, node bodies).
- **Bundle size:** **`@next/bundle-analyzer`** → confirm three/drei/xyflow weight and code-split wins.
- **DB timing:** enable Prisma `log: ['query']` with durations (or `pg` slow-query log); add **Server-Timing** headers per API route to see DB vs LLM vs sync time in the Network panel. This will make B1's serialization obvious.
- **WebGL:** **`r3f-perf`** (drei) overlay → FPS, draw calls, memory, live context count per diagram.
- **Browser:** Chrome DevTools **Performance** panel (record while panning a many-node canvas and while streaming an answer) + **Lighthouse**; a `PerformanceObserver` for `longtask` to catch main-thread blocks.
- **Prod RUM (later):** OpenTelemetry or Sentry Performance for real-user INP/latency.
Capture a before/after with these around the P0 fixes so the win is measurable.

---

## 5. Market comparison — how canvas apps stay fast
Figma, Miro, and tldraw handle thousands of objects on one canvas via: **viewport culling** (render only what's visible — our B2), **level-of-detail** (simplify/rasterize off-screen or zoomed-out content — our B3 static previews), a **single GPU surface** rather than one context per object (our B3 anti-pattern), tile/virtualized rendering, and heavy **memoization**. React Flow's own scaling guidance is the same short list: `onlyRenderVisibleElements`, memoized lightweight nodes, no inline props, virtualization. openmaths' one-WebGL-canvas-per-node is the pattern these products explicitly avoid — rasterized previews + a single live renderer for the focused node is the fix.

---

## 6. Acceptance criteria & targets
- AC-A: streamed prose stays visible on completion; steps are additive; no swap/flicker (§A4).
- AC-B1: DB pool raised; concurrent queries no longer serialize (Server-Timing shows parallel DB work).
- AC-B2/B3: `onlyRenderVisibleElements` on; off-screen nodes don't mount WebGL; ≤1 live WebGL context (the focused/animating one) + rasterized previews elsewhere; panning a 15-node canvas holds ~60fps.
- AC-B4: streaming no longer re-parses per token or thrashes height (batched flush, frozen auto-grow); INP during streaming < 200ms.
- AC-B5: board route initial JS materially reduced (bundle-analyzer before/after); R3F loads only when a diagram appears.
- AC-measure: web-vitals + Server-Timing + r3f-perf wired; a documented before/after on a representative canvas in a **prod build**.
- No regression to `docs/PRD-v2-production.md` §5.4.

---

## 7. File index & sources
**Change:** `src/lib/prisma.ts` (pool max), `src/components/board/BoardCanvas.tsx` (`onlyRenderVisibleElements`, memo), `src/components/board/nodeTypes/*` (`React.memo`, dynamic import of engine), `src/components/engine/BlockCanvas.tsx` (rasterized previews, frameloop demand, drop preserveDrawingBuffer off-export), `src/components/engine/TimelineTicker.tsx` + `SceneInterpreter.tsx` (narrow selectors), `src/components/board/nodeTypes/{NodeBody,MessageBubble,useAutoGrowHeight}.tsx` (batched stream flush, freeze auto-grow, answer-render fix), `src/lib/board/context.ts` + `webLinkSync.ts` (batch ancestor queries), `src/lib/ai/usageStats.ts` (SQL aggregation), `src/app/api/blocks/[blockId]/messages/route.ts` (parallelize + Server-Timing), `next.config.ts` (bundle-analyzer), new `instrumentation`/web-vitals reporter.

**Sources:**
- Optimize React Flow for large-scale canvases: https://azimuahamed.medium.com/5-ways-to-optimize-your-react-flow-canvas-for-large-scale-applications-7a9a9d85a9aa
- React Flow perf — large numbers of nodes/edges (xyflow discussion): https://github.com/xyflow/xyflow/discussions/4975
- Architecting for massive scale in React Flow — VisualFlow: https://www.visualflow.dev/blogs/scale-studio-pro
- The ultimate guide to optimize React Flow performance — Synergy Codes: https://community.synergycodes.com/topic/18/the-ultimate-guide-to-optimize-react-flow-project-performance
- Next.js Web Vitals / `useReportWebVitals` (INP): https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals
