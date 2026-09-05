# openmaths — PRD: Sharing, Access Roles, Notifications & Collaboration

| | |
|---|---|
| **Product** | openmaths — AI math explainer (canvas / node-graph app) |
| **Version** | 1.0 (companion to the other `docs/PRD-*.md`) |
| **Author** | Razin (with Claude) |
| **Date** | 2026-08-20 |
| **Audience** | Claude Code (implementing agent) working in this repo |
| **Scope** | A production sharing + collaboration system: **two share methods** (invite-by-email and share-link), **access roles**, invite/notification flow, **badges/notifications** for recipients, permission enforcement, and a **seed + full feature-test QA plan** (the reset→test→share→badge scenario). |

> ⚠️ **Not executed live.** The "delete all users except test+razin, wipe all canvases, seed a test canvas, test every feature, share with razin, verify view/edit, add badges" flow is captured here as a **runnable seed script + QA acceptance matrix** (§9) for Claude Code to implement and run against a **dev/staging** database — never a blind destructive delete against production data.

---

## 1. What you asked for (requirements, restated)
1. **Reset the environment** to exactly two users — a **test user** and the **razin** user — and remove all existing canvases (dev/staging only, guarded). → §9 seed script.
2. In the **test user**, **create a canvas and exercise every feature** one by one. → §9 feature-test matrix.
3. **Share that canvas with razin**, and verify **razin can open, view, and edit** per the role granted. → §3–§5 + §9.
4. When something is shared with razin, show **a badge / notification** on his account ("shared with you"). → §6.
5. Support **two sharing methods** — a **shareable link** and **invite-by-email (typing an address)** — with **access roles** and a clear story for **how the recipient gets access**. → §3–§5.
6. Backed by **market/competitor research** on how big tech & SaaS do sharing. → §2.

---

## 2. Market & competitor research — how the best do sharing
Every mature collaboration product converges on **two methods + a role menu + notifications**. Sources in §11.

### 2.1 The two methods (universal pattern)
- **Method A — Invite specific people by email** (typed address / picker). Each invitee is assigned a **role**, optionally emailed a notification, and appears in a "people with access" list you can change or remove. Best for named, private collaboration.
- **Method B — Share link ("general access")** with a **role and a scope**: *Restricted* (only invited people) → *Anyone with the link* (view / comment / edit) → *Team/workspace*. Best for quick, broad, low-friction sharing.

### 2.2 Access roles (the menu everyone ships)
| Role | Can do |
|---|---|
| **Owner** | Everything incl. delete, transfer ownership, manage sharing |
| **Editor** | View + edit content; usually cannot re-share/manage access |
| **Commenter** | View + add comments/annotations; no content edits |
| **Viewer** | Read-only |

### 2.3 How the leaders map to this
| Product | Method A (invite) | Method B (link) | Roles | Notify recipient |
|---|---|---|---|---|
| **Miro** (closest — a canvas/board) | Email invite w/ role | Link: anyone can *edit/comment/view*, or team-only; visitors join via link | Owner, Co-owner, Editor, Commenter, Viewer | In-app + email; "shared with me" |
| **Google Docs/Drive** | "Share with people" + role + "Notify people" email | "General access": Restricted / Anyone-with-link × Viewer/Commenter/Editor | Viewer, Commenter, Editor, Owner (+ transfer) | Email + "Shared with me" + bell |
| **Notion** | Invite person w/ role | "Share to web" link (toggle edit/comment/duplicate) | Full access, Can edit, Can comment, Can view | Inbox notifications |
| **Figma** | Invite by email (edit/view) | "Anyone with the link" (view/edit) | Can edit, Can view (+ owner/admin) | Notifications |
| **Box/Dropbox/M365** (enterprise) | Invite + role | Link + **expiry, password, download on/off, domain allow-list** | Owner/Editor/Viewer/Uploader | Email + activity feed |

### 2.4 Security & UX practices worth adopting
- **Link hygiene:** high-entropy tokens (we have `cuid`), **revoke**, **expiry**, optional **password**, and a role **cap** on links ("anyone with link" should usually default to *Viewer*, not Editor).
- **Least privilege by default:** default new shares to the lowest useful role; make "Editor" a deliberate choice.
- **Enforce on the server, every mutation** — never trust the client to respect a role.
- **Recipient clarity:** a "Shared with me" surface + an unread **notification/badge** so people discover what was shared without a link in an email.
- **Owner-only access management;** editors can use, not re-share (matches our current owner-gating).
- **Audit/visibility:** show who has access and when it was granted.

---

## 3. Current state in openmaths (code-derived) + gaps
**Already built:**
- **Method A (email):** `POST /api/canvases/[id]/share` upserts a `CanvasCollaborator {canvasId, email}`; `DELETE …/share/[collaboratorId]` removes. UI in `ShareDropdown.tsx` (invite field + list).
- **Method B (link):** `POST/DELETE …/share-link` creates/revokes a `CanvasShareLink {canvasId, token}`; visiting `/canvas/[id]?share=token` (in `canvas/[canvasId]/page.tsx`) **upserts the visitor as a collaborator** (standing access) then loads the canvas.
- **Access check:** `canvasAccessWhere(user)` = `owner OR collaborators.some(email == user.email)` — used on every canvas/block/connection query.
- **Owner-only management:** `assertOwnedCanvas` gates share management.

**Gaps (this PRD fills):**
1. **No access roles.** `CanvasCollaborator` has no `role`; **every collaborator gets full edit**. Viewer/Commenter/Editor don't exist.
2. **No link role/expiry/scope.** A link grants full-editor collaborator access to anyone who opens it; no "anyone-with-link = view", no expiry, no revoke-per-role.
3. **No real invite/notification.** Adding an email just writes a row; **no email is sent**, and the person only gets in if they later sign up with that exact email. No **pending-invite** state.
4. **No notifications / badges** anywhere ("shared with you" is invisible to the recipient). ← your explicit need.
5. **No "Shared with me"** surface distinct from owned canvases (the dashboard lists all accessible canvases with an `isOwner` flag but no shared-with-me grouping/label).
6. **No permission enforcement by role** on block/connection mutations (any collaborator can edit/delete anything).
7. **No presence / real-time** co-editing (last-write-wins via REST; fine for v1, note for later).

---

## 4. Method A — Invite by email (with roles, invites & notifications)
**UX (extend `ShareDropdown.tsx`):** type an email → pick a **role** (Viewer / Commenter / Editor) → Invite. The people-list shows each collaborator with an editable **role dropdown** and a remove (✕). Owner is labeled and non-editable.

**Behavior:**
- On invite, create a **`CanvasCollaborator {canvasId, email, role, status}`** where `status = "pending"` until that email signs in/up, then `"active"`. (Keeps today's "email-based" model but adds role + status.)
- **Send an email notification** ("Razin invited you to *Canvas title*") with a deep link. If email infra isn't wired yet, still create an **in-app notification** (§6) the moment the invitee's account exists, and surface it in "Shared with me".
- **Re-invite / change role / revoke** update the row; revoking removes access immediately (enforced server-side).
- **Self-invite / duplicate** guarded (already partially handled).

**Acceptance:** razin, invited as **Editor**, opens the canvas and can edit; invited as **Viewer**, he can open but every mutation is blocked (server-enforced) and the UI shows read-only affordances.

---

## 5. Method B — Share link (with role, scope, expiry, revoke)
**UX:** a "Share link" section with **General access** control — *Restricted* (only invited) vs **Anyone with the link** — and a **role** for the link (default **Viewer**; Editor is a deliberate choice), plus **Copy link**, **expiry** (e.g. off / 24h / 7d / 30d), and **Revoke**.

**Behavior (extend `CanvasShareLink`):** add `role` and `expiresAt`. On redemption (`?share=token`):
- Validate token + not expired.
- Grant access at the **link's role** — either as a lightweight "link access" (no row) for anonymous/any-viewer, or by upserting a `CanvasCollaborator` at that role for signed-in users (so it persists), **capped at the link's role** (a Viewer link can never confer Editor).
- Respect *Restricted*: a restricted canvas ignores link redemption for non-invited users.

**Security:** cuid tokens (have), **expiry + revoke** (add), role cap, and — optional, enterprise-grade — a **password** on the link. Rotating the token invalidates old links.

**Acceptance:** a Viewer link lets anyone open read-only; an Editor link lets a signed-in user edit; revoking or expiring the link blocks further access; a Restricted canvas can't be opened by link.

---

## 6. Notifications & badges (your "add badges on razin when shared")
Add a first-class **notification system** so a recipient *discovers* shares.

**Data model — new `Notification`:**
```
model Notification {
  id        String   @id @default(cuid())
  userId    String                 // recipient
  type      NotificationType       // CANVAS_SHARED, ROLE_CHANGED, COMMENT, ...
  canvasId  String?
  actorId   String?                // who did it (e.g. the test user)
  data      Json?                  // { canvasTitle, role, ... }
  readAt    DateTime?
  createdAt DateTime @default(now())
  @@index([userId, readAt])
}
enum NotificationType { CANVAS_SHARED  ROLE_CHANGED  CANVAS_UNSHARED  COMMENT_ADDED }
```

**Triggers:** on invite / link-first-open / role change → create a `Notification` for the recipient (and, for email-invite, the email too).

**Surfaces (UX):**
- A **bell icon in the top bar (`CanvasTopBar`) / dashboard** with an **unread count badge** (reuse `components/ui/badge.tsx`). Clicking opens a notification list ("Test User shared *Right Triangle Area* with you — Editor").
- A **"Shared with me"** section on the dashboard (`CanvasList`), with a **"Shared" badge** and the granter + role on each shared canvas card. (The API already returns `isOwner`; add `role` + `sharedBy`.)
- Mark-as-read on open; `GET /api/notifications` (list + unread count), `POST /api/notifications/read`.
- Delivery: poll on an interval (simple, v1) or SSE/websocket later. Optional email digest.

**Acceptance:** the moment the test user shares with razin, razin's bell shows an unread badge and a "shared with you" entry; the canvas appears under "Shared with me" with a role badge; opening it clears the unread.

---

## 7. Permission enforcement (make roles real)
Roles are worthless unless enforced **server-side on every mutation**. Today `canvasAccessWhere` only answers "can this user see the canvas at all."

- Add a **`resolveCanvasRole(user, canvasId): "owner"|"editor"|"commenter"|"viewer"|null`** helper (owner > active collaborator role > link role).
- Gate each route by required role:
  - **Editor+**: create/update/delete blocks (`/api/blocks*`), connections (`/api/connections*`), messages/generation, note edits, positions.
  - **Commenter**: (future) comments/annotations only.
  - **Viewer**: all mutations return **403**; only GETs allowed.
  - **Owner-only**: sharing management, canvas delete/rename, ownership transfer.
- **Client** reflects the role: hide/disable edit affordances for Viewer/Commenter (read-only board — no Dock create, no prompt input, no delete), show a subtle "View only" chip. But the **server is the source of truth**.

**Acceptance:** a Viewer's attempt to create/edit/delete (even via direct API call) is rejected with 403; the UI is cleanly read-only.

---

## 8. Data model changes (Prisma — additive, migrations)
```prisma
enum CanvasRole { OWNER EDITOR COMMENTER VIEWER }
enum CollaboratorStatus { PENDING ACTIVE }

model CanvasCollaborator {
  // + role   CanvasRole @default(EDITOR)   // keep EDITOR as the back-compat default so existing rows behave as today
  // + status CollaboratorStatus @default(ACTIVE)
  // + invitedById String?  invitedAt DateTime @default(now())
}

model CanvasShareLink {
  // + role      CanvasRole @default(VIEWER)
  // + expiresAt DateTime?
  // + createdById String?
}
// + Notification model + NotificationType enum (see §6)
```
**Back-compat:** default existing collaborators to `EDITOR/ACTIVE` so current behavior is unchanged; default new links to `VIEWER`. Existing `?share=token` redemption keeps working, now honoring the link role.

---

## 9. Seed + full feature-test QA plan (your reset→test→share flow, made runnable)
Deliver as a guarded script (e.g. `scripts/seed-test.ts`, run with `SEED_CONFIRM=1` and **only** when `NODE_ENV !== "production"` / a non-prod `DATABASE_URL`) — never an unguarded delete.

**A. Reset & seed (dev/staging only):**
1. Assert non-production DB (refuse otherwise). Require an explicit confirm env var.
2. Keep users whose email ∈ {`TEST_USER_EMAIL`, `razin's email`}; **delete all other users** (cascades their canvases/blocks). Create the test + razin users if missing (hashed passwords).
3. **Delete all canvases** (all users), leaving a clean slate.
4. As the **test user**, create one canvas "QA — All Features".

**B. Feature-test matrix (exercise each, one by one — script + Playwright E2E; Chromium is preinstalled):**
- Create QUESTION node → ask a math question → assert streamed answer + `solution`/`finalAnswer`.
- Non-visual problem (the centroid north-star) → assert correct steps + answer.
- Diagram generation (needsGraph) → GRAPH node created + connected; open fullscreen; play animation; **narration** (one `/narrate` pass, no duplicate requests); **video export** + **voiceover export**.
- Multiple forms: algebra `solution_steps`, `table`, `plot` render (per PRD v2).
- SUB_QUESTION via selection "Ask (new chat)"; @-mention a connected node; `/` skill; web search (Exa); attach image/PDF → **Gemini** route; 🎤 mic → **STT** transcript.
- NOTE node: write, autosave, fullscreen editor, "Ask AI".
- LINK node: add tab, preview, fullscreen browser; auto-link from citations.
- Node ops: move/persist position, resize, collapse, duplicate, delete; edge create (drag-to-node, drag-to-blank → sub-question), edge delete; PDF export.
- Settings: profile, model/effort, usage (incl. tts event), skills, appearance.

**C. Sharing acceptance (the core of this PRD):**
1. Test user opens Share → **invite razin as Editor** (email). Assert `CanvasCollaborator{role:EDITOR,status}` + a **Notification** for razin.
2. Sign in as **razin** → **bell shows unread badge**; "Shared with me" shows the canvas with an **Editor** badge and "shared by Test User".
3. Razin **opens & edits** (add a node) → succeeds; test user sees it.
4. Change razin to **Viewer** → razin's board becomes read-only; a mutation API call returns **403**.
5. Generate a **share link (Viewer)** → open in a fresh/incognito session → read-only access; **revoke** → access blocked; set **expiry** in the past → blocked.
6. **Restricted** general access → link open by a non-invited user is denied.

**Acceptance:** the whole B+C matrix passes in CI; the seed script is idempotent and refuses to run on production.

---

## 10. Rollout & acceptance
**Phases:** P1 roles + enforcement (§7/§8) · P2 email-invite w/ status + link role/expiry/revoke (§4/§5) · P3 notifications + badges + "Shared with me" (§6) · P4 seed + E2E QA (§9) · P5 (later) real-time presence/comments.

**Global acceptance:**
- AC1. Two methods (email-invite + link) each with a **role**; least-privilege defaults (link=Viewer).
- AC2. Roles **enforced server-side**; Viewer mutations → 403; UI read-only for non-editors; owner-only sharing/delete/transfer.
- AC3. Recipient gets a **notification + unread badge** and a **"Shared with me"** entry with role + granter (razin sees it when the test user shares).
- AC4. Link supports **expiry + revoke** (+ optional password); redemption honors the link role and *Restricted* scope.
- AC5. Pending-invite state + (email or in-app) notification; re-invite/role-change/revoke all work and take effect immediately.
- AC6. Seed/QA script is **guarded** (non-prod only, explicit confirm) and the full feature+sharing matrix passes; no existing behavior regresses (`docs/PRD-v2-production.md` §5.4).

---

## 11. File index & sources
**Change:** `prisma/schema.prisma` (+migrations: roles, status, link role/expiry, `Notification`), `lib/canvasAccess.ts` (+ new `resolveCanvasRole`), `api/canvases/[id]/share/route.ts`, `api/canvases/[id]/share/[collaboratorId]/route.ts`, `api/canvases/[id]/share-link/route.ts`, `canvas/[canvasId]/page.tsx` (link redemption honoring role/expiry), **new** `api/notifications/*`, all `api/blocks*` + `api/connections*` + `messages`/`write-note` (role gating), `components/board/ShareDropdown.tsx` (roles/link settings), `components/board/CanvasTopBar.tsx` + `components/dashboard/CanvasList.tsx` (bell/badge + "Shared with me"), **new** `scripts/seed-test.ts` + Playwright specs.

**Sources (research §2):**
- Miro — Board access rights & roles: https://help.miro.com/hc/en-us/articles/360017572194-Board-access-rights , https://help.miro.com/hc/en-us/articles/360017571194-Roles-in-Miro
- Miro — Sharing boards & inviting collaborators: https://help.miro.com/hc/en-us/articles/360017730813-Sharing-boards-and-inviting-collaborators
- Google Docs/Drive sharing (roles + link vs invite): https://ithy.com/article/google-docs-sharing-guide-auxyocc6
- Box — Link-sharing best practices (expiry, password, scope): https://blog.box.com/link-sharing-best-practices
- Dropbox — Share files securely (external sharing controls): https://www.dropbox.com/resources/share-large-files-securely
- Role-based access control (RBAC) overview: https://en.wikipedia.org/wiki/Role-based_access_control
