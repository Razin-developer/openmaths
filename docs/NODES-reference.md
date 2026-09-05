# openmaths — Node & Canvas Reference

A code-derived reference of every node type on the canvas: what it does, its type mapping, handles/connections, and how it's created. Sourced from the actual code (`prisma/schema.prisma`, `Board.tsx`, `BoardCanvas.tsx`, the `nodeTypes/*` components, the `/api/blocks`, `/api/connections` routes, and `graphSync`/`webLinkSync`).

---

## 1. The five node kinds (data model)
`BlockKind` enum (`prisma/schema.prisma`, `lib/board/types.ts`): **`QUESTION`, `SUB_QUESTION`, `GRAPH`, `NOTE`, `LINK``.

Each is a `Block` row. Kind → React-Flow node type → component (`Board.tsx` `NODE_TYPE_BY_KIND` + `BoardCanvas.tsx` `nodeTypes`):

| Kind | RF node type | Component | Chat? | Handles (connect points) |
|---|---|---|---|---|
| `QUESTION` | `questionBlock` | `QuestionNode` | ✅ | target (Left) + source (Right) |
| `SUB_QUESTION` | `questionBlock` | `QuestionNode` | ✅ | target (Left) + source (Right) |
| `GRAPH` | `graphBlock` | `GraphNode` | ❌ | target (Left) only |
| `NOTE` | `noteBlock` | `NoteNode` | ❌ | source (Right) only |
| `LINK` | `linkBlock` | `WebLinkNode` | ❌ | target (Left) + source (Right) |

Shared `Block` fields: `id, canvasId, parentBlockId, kind, status, title, prompt, modelId, reasoningEffort, scene (Json), notes, tabs (Json), errorMessage, positionX/Y, messages[]`.
`BlockStatus`: `DRAFT → GENERATING → READY → ERROR`.
Per-node UI state (`store/boardUiStore.ts`): `layout` (collapsed/default), `fullscreen`, `diagramMounted/Visible` (WebGL mount cap = 6), `manuallyResized`. Playback state per GRAPH lives in `store/blockStore.ts`.
Default sizes (`Board.tsx`): question/graph/note **320×420**; LINK **240×180**; a still-empty question/note starts **210** tall. Resizable via `NodeResizer` within min/max bounds.

---

## 2. QUESTION / SUB_QUESTION — `QuestionNode`
**Function.** The core "ask a math question" node. Owns a **chat thread** (`Message` rows, USER/ASSISTANT) and streams AI answers. Renders header (`NodeHeader`) + body (`NodeBody` → `ChatThread` + `PromptInput`); an empty node shows just the prompt input. An answer can be prose (`answerMarkdown`), structured `solution` steps + pinned `finalAnswer`, a `table` form, and can spawn a connected **GRAPH** diagram and **LINK** web node. `SUB_QUESTION` is the *same component*, created as a child (has `parentBlockId`) — i.e. a follow-up/branch off a selection, a parent question, or a note.

**Input affordances (`PromptInput`).** Type a question; `/` = skill preset, `@` = mention a connected node; attach image/PDF; 🎤 mic → `/transcribe` (Whisper STT); 🌐 web search (Exa); model + reasoning-effort per node; Enter to send (optimistic).

**Header actions (`NodeHeader`).** Collapse/expand, Fullscreen (`NodeFullscreen`), Duplicate, Export PDF (`ExportButton` → `/export-pdf`), Delete.

**Creation.**
- **Top-level QUESTION:** Dock "New block" (shortcut **Q**), canvas right-click → "New question here" (`CanvasContextMenu`), or the empty-canvas CTA → `POST /api/blocks` with no `parentBlockId`/`kind` → server infers `QUESTION`.
- **SUB_QUESTION (child):** created with a `parentBlockId` from — (a) `SelectionToolbar` "Ask (new chat)" on selected answer text, (b) dragging from a node's source handle onto **blank canvas** (`BoardCanvas.onConnectEnd`), or (c) `NoteNode` "Ask AI". `POST /api/blocks` with `parentBlockId` → server sets `SUB_QUESTION` **and auto-creates a Connection** parent→child.
- **Duplicate:** `NodeHeader` → `POST /api/blocks` copying the prompt.
- Every create logs an `ActivityEvent BLOCK_CREATED`.

**Connections.**
- *Outgoing (source):* → GRAPH (auto, `syncGraphNode`), → LINK (auto, `syncWebLinkNodes` from web-search citations), → SUB_QUESTION children.
- *Incoming (target):* from a parent QUESTION (context), a NOTE (context), or a LINK (site-restricted search).
- *Manual:* drag from the Right handle onto another node's card → `POST /api/connections`.
- *AI context:* incoming connections + the ancestor chain (`parentBlockId`, depth 5) feed generation (`buildGenerationContext`): a QUESTION contributes its latest answer, a NOTE its text, a LINK a live Exa site-search; GRAPH never contributes text.

---

## 3. GRAPH — `GraphNode`
**Function.** Renders and **animates an AI-authored diagram** (the `Scene` DSL) on a WebGL/R3F canvas. Inline it shows a static preview (`BlockCanvas mode="static"`) with zoom +/- and collapse; the Fullscreen (`Film`/`Expand`) button opens `GraphAnimationFullscreen` — the step-by-step animation player with a step sidebar, per-step captions/"Why?", **narration (TTS)**, transcript, and **video / voiceover export**. Read-only: **no chat thread**.

**Creation.** **Never** via the generic `/api/blocks` endpoint. It is **server-driven only**: the messages route calls `syncGraphNode` when a generated answer has `needsGraph && scene`. It creates one GRAPH child per question (or several *named* diagrams), positioned ~360px to the right, and **updates the existing one in place** when the same diagram name recurs (so a follow-up refines the figure instead of spawning duplicates).

**Connections.** Exactly **one incoming** edge from its QUESTION/SUB_QUESTION source — the `/api/connections` route enforces "*Graph nodes can only connect to one node*". No outgoing edges. (Handle: target/Left only.)

**Delete.** `DELETE /api/blocks/[id]` (also removes its scene). Accepted scene op types are enumerated in `docs/PRD-fullscreen-animation-ux.md` §1.2.

---

## 4. NOTE — `NoteNode`
**Function.** A free-form **Markdown/LaTeX scratch note** (content stored in `prompt`). Inline it shows a rendered preview; clicking opens `NoteFullscreen` — an edge-to-edge editor with a formatting toolbar (bold/italic/heading/list/quote/code/link), live preview toggle, and **"Ask AI to write"** (`/write-note`, returns markdown to insert). Edits autosave via a debounced `PATCH /api/blocks/[id]` (prompt + derived title). Header **"Ask AI about this note"** creates a connected QUESTION and streams a *casual* answer from the note text.

**Creation.** Dock "New note" (shortcut **N**) or right-click → "New note here" → `POST /api/blocks` with `kind:"NOTE"`. Starts empty ("click to open fullscreen and start writing").

**Connections.** Handle: **source (Right) only** — a note feeds *into* questions, it is never a target. "Ask AI about this note" creates a QUESTION and a Connection note→question; the note's text becomes context (`buildGenerationContext` → "Context from a connected note"). Can also be manually connected via the handle and `@`-mentioned.

---

## 5. LINK / Web Browser — `WebLinkNode`
**Function.** A **multi-tab web-browser node**. Holds a list of `BrowserTab {id, url, title, favicon}` in the `tabs` Json (legacy single-URL links fall back to `prompt`). Grid or list view, add/remove tabs, click a tab → `WebBrowserFullscreen`. Adding a tab fetches `/api/link-preview` (`checkUrl` → title/favicon/HTTP status) and reports dead links. Its purpose in the graph: give connected questions a **site to search** — an Exa search restricted to that domain (`getInheritedWebLinks` / `extractDomain`), inherited by sub-questions.

**Creation.**
- *Manual:* Dock "New browser" (shortcut **L**) or right-click → "New browser here" → `POST /api/blocks` with `kind:"LINK"` (starts empty; add a URL).
- *Auto:* `syncWebLinkNodes` — when a question runs a web search and the answer cites URLs, each valid new URL is added as a **tab** on the question's single connected LINK node (created on first use, positioned ~360px to the **left**). Dead/invalid URLs are skipped and reported.

**Connections.** Handles: source (Right) + target (Left). Connected **into a QUESTION** it means "search this site for this," restricting Exa to that domain and cascading to sub-questions (ancestor depth 5). One LINK per question aggregates auto-added citations rather than spawning a node per link.

---

## 6. Connections (edges)
**Data model.** `Connection {id, canvasId, sourceBlockId, targetBlockId, label}` — unique per `(source,target)`. Rendered as `DeletableEdge` (bezier; hover shows an ✕ to delete → `DELETE /api/connections/[id]`).

**How edges are created.**
- *Auto (server):* question→GRAPH (`syncGraphNode`), LINK→question (`syncWebLinkNodes`), parent→child SUB_QUESTION (`POST /api/blocks` with `parentBlockId`).
- *Manual (client):* drag from a node's **source handle (Right)** onto another node's card → `BoardCanvas.onConnectEnd` → `POST /api/connections`. Dragging onto **blank canvas** instead creates a new connected SUB_QUESTION there.

**Rules & semantics.**
- A GRAPH may have only **one** incoming edge (enforced in the connections route).
- Canvas access is checked on every create.
- Direction feeds AI context: incoming edges + the `parentBlockId` ancestor chain (depth 5) are gathered in `buildGenerationContext`; `getConnectedBlocks` (both directions) powers `@`-mentions. GRAPH nodes never contribute text context.

---

## 7. `POST /api/blocks` — the one creation endpoint (kind resolution)
```
kind =
  requestedKind === "NOTE" | "LINK"   → that kind
  else parentBlockId present          → "SUB_QUESTION"  (+ auto Connection parent→child)
  else                                → "QUESTION"
// GRAPH is NEVER created here — only via syncGraphNode (server).
// LINK is also created implicitly by syncWebLinkNodes.
```
Also: `PATCH /api/blocks/[id]` (position, title, model/effort; prompt/tabs for NOTE/LINK), `GET`/`DELETE /api/blocks/[id]`, and per-block sub-routes `/messages` (chat stream), `/transcribe` (STT), `/write-note` (NOTE AI), `/narrate` (GRAPH TTS), `/export-pdf`.

---

## 8. One-line summary per node
- **QUESTION / SUB_QUESTION** — ask/answer chat node; the hub. Spawns diagrams, notes-as-context, web nodes, and sub-questions. Full handles.
- **GRAPH** — read-only animated diagram; server-created from an answer; exactly one incoming edge.
- **NOTE** — markdown/LaTeX scratch pad; source-only; "Ask AI" turns it into a question.
- **LINK** — multi-tab browser; gives connected questions a site to search; created manually or auto-populated from citations.
- **Edge (`DeletableEdge`)** — a `Connection` row; auto- or drag-created; carries context in its direction; GRAPH limited to one.
