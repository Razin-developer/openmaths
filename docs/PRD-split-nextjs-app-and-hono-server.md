# openmaths — PRD: Split into `app` (Next.js) + `server` (Hono)

| | |
|---|---|
| **Product** | openmaths — AI math explainer |
| **Version** | 1.0 |
| **Author** | Razin (with Claude) |
| **Date** | 2026-09-03 |
| **Audience** | Claude Code (implementing agent) |
| **Scope** | Restructure the current Next.js monolith into two deployables in one repo: **`app`** (Next.js — UI/SSR only, **no `/api`**) and **`server`** (Hono — every route, CRUD, connections, auth, DB, env, security, production features). The web app talks to a clean **base-URL API**. **No change to any UI, UX, or client behavior.** No API keys or sensitive/AI work ever leave the server. |

> ⚠️ **Hard constraint — behavior parity.** This is a *plumbing* migration. Every screen, interaction, animation, stream, optimistic update, error toast, and SSR render must behave **identically** before and after. Any observable UX change is a bug. §7 is the binding parity contract.

---

## 1. Objective & constraints (verbatim)
- Move **everything under `src/app/api/*`** (38 route files across auth, blocks, canvases, connections, link-preview, models, notifications, skills, usage, user) into a standalone **Hono server**: every route, each CRUD, connections, **auth, DB, env, security measures, production features**.
- The Next.js **`app`** keeps only UI + SSR/RSC + a **base-URL-based API client**; it holds **no secrets** and **no DB**.
- **Do not change** any UI/UX/functionality in the client.
- **Never expose API keys.** All AI calls (hackai-sdk: chat, TTS, STT, Exa, Gemini, embeddings) and any censored/sensitive work run **only on the server**.
- The app should **communicate almost exclusively with our own server** — not third-party APIs directly — except genuinely non-essential public assets (e.g. web fonts).

---

## 2. Current state (why this is non-trivial)
- **Monolith**: Next.js 16 App Router; **38 API routes** in `src/app/api/*`; NextAuth/Auth.js v5 (now with MFA, email verify, password reset, session management), Prisma 7 + pg, `@razinmohammedpt/hackai-sdk@2`.
- **DB is coupled into the web layer in two ways** — the migration's real work:
  1. **7 SSR/RSC pages call the DB directly** via `requireUser()`/`getCurrentUser()` + Prisma: `canvas/[canvasId]/page.tsx`, `settings/{appearance,insights,model,profile,skills,usage}/page.tsx`. These render server-side from the DB today.
  2. **2 pages import `@/lib/prisma` directly** (`canvas/[canvasId]/page.tsx`, `settings/skills/page.tsx`).
- **36 client `fetch('/api/...')` call sites** across components (chat send, CRUD, sharing, notifications, narrate, transcribe, etc.).
- **Streaming routes** (NDJSON): `messages`, `narrate`, `explain-step`, `redraw` (+ `transcribe` request/response). These must keep streaming byte-for-byte the same to the client.
- **Auth** is deep: `src/auth.ts`, `src/proxy.ts` middleware, `getCurrentUser`/`requireUser`, and the new `auth/{signup,verify,forgot-password,reset-password,mfa-check}` + `user/{mfa/*,password,sessions}` routes.
- **Secrets today** are already server-only (good): `HACKCLUB_AI_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`. The migration formalizes and hard-guarantees this.

---

## 3. Target architecture — monorepo

```
openmaths/                      (pnpm workspaces + Turborepo)
├─ app/          ← Next.js: pages, RSC/SSR, components, the API client. NO /api business routes, NO Prisma, NO secrets.
├─ server/       ← Hono: ALL routes, auth, DB access, AI (hackai-sdk), env, security, production features. Holds ALL secrets.
├─ site/         ← Next.js marketing/product site (landing, tools, blog, legal…). SSG/ISR + SEO. See docs/PRD-marketing-site-and-design-system.md.
├─ packages/
│  ├─ db/        ← Prisma schema + generated client + migrations (imported by server ONLY).
│  ├─ shared/    ← zod schemas + TS types shared across app/site/server (envelope/SolutionStep/TableForm, dsl/Scene, DTOs, constants). Client-safe.
│  └─ api-client/← base-URL typed client used by app + site (Hono RPC `hc` + a raw-fetch streaming layer).
└─ turbo.json, pnpm-workspace.yaml
```

- **`server` (Hono)** is the single source of truth for data, auth, and AI. It owns `DATABASE_URL`, `AUTH_SECRET`, `HACKCLUB_AI_API_KEY`, and every other secret.
- **`app` (Next.js)** renders the UI and calls the server through `packages/api-client`. Its only env is `NEXT_PUBLIC_API_BASE_URL` (public, non-secret) and a **server-side** `API_INTERNAL_URL` for SSR calls.
- **`packages/shared`** eliminates type drift: the client renders `Scene`/`SolutionStep`/`TableForm` that the server produces — both import the same definitions. Move `src/lib/ai/envelope.ts` types, `src/lib/dsl/types.ts`, and route DTOs here.
- **`packages/db`** centralizes Prisma; only the server depends on it. Migrations run from here.

---

## 4. Deployment topology & auth model (the crux)

### 4.1 Two viable topologies — recommend A, support both via the base URL
- **A — Same-origin via reverse proxy / Next rewrites (recommended default, lowest risk).** Web served at `openmaths.com`; all API under `openmaths.com/api/*` **rewritten to the Hono service**. Same origin ⇒ **zero CORS**, the session cookie is first-party and "just works", streaming works unchanged, and the client can keep calling `/api/...` (the base URL is same-origin) — which makes behavior parity trivial. The Hono server is still a separate deployable; Next only proxies.
- **B — Separate origin / subdomain.** API at `api.openmaths.com`; the session cookie is set on the parent domain (`Domain=.openmaths.com`, `SameSite=Lax`, `Secure`, `HttpOnly`); the client uses `credentials: 'include'`; Hono runs a strict CORS allowlist for the web origin. Cleaner separation; more config (CORS + preflight for streaming).

Both are selected by **`NEXT_PUBLIC_API_BASE_URL`** — `/api` for A, `https://api.openmaths.com` for B. Build the client so switching is one env var. Ship **A** first (least risk to the parity constraint); B is available when a fully independent API deploy is wanted.

### 4.2 Auth across the split (auth moves to the server)
- **Hono becomes the identity provider.** Port `signup / login / verify / forgot-password / reset-password / mfa-* / sessions / password / [...]` to Hono. It issues a **signed session** (JWT via `jose`, reusing the existing bcrypt + Prisma logic) in an **`HttpOnly`, `Secure`, `SameSite` cookie** on the shared registrable domain.
- **The browser** sends that cookie automatically to the server (same-site in A; parent-domain in B). No token in JS/localStorage → XSS can't steal it.
- **Next middleware (`proxy.ts` → keep as the edge gate)** verifies the session **locally** with the shared `AUTH_SECRET`/JWKS (no DB, no round-trip) to gate pages/redirect to `/login` — behavior identical to today.
- **SSR/RSC pages** (the 7 that hit the DB) call the server **server-to-server**, forwarding the incoming request's cookie via a `serverApi()` helper that reads `next/headers` `cookies()`. This preserves SSR (no client loading flash → no UX change). They no longer import Prisma.
- **Interim de-risking option (optional):** keep NextAuth in web as a *verifier only* while data/AI routes move first, then cut auth over last. End state = auth fully in Hono (per the requirement).
- Fold in the **auth hardening** from `docs/PRD-auth-security-audit.md` while auth is being rewritten (constant-time login, rate-limit/lockout, verified-email access, SSRF guard, headers) — this migration is the natural moment to land those.

### 4.3 CSRF
Cookie-auth mutations get CSRF protection via `SameSite` + a **double-submit token** (or an `Origin`/`Fetch-Metadata` check) enforced in Hono middleware. The client already sends `Content-Type: application/json` on all mutations (a de-facto CSRF barrier); formalize it.

---

## 5. Component specs

### 5.1 `server` — Hono
- **Route parity map (all 38 → Hono):** recreate every route with identical method, path, request/response shape, status codes, and **NDJSON streaming** semantics (`messages`, `narrate`, `explain-step`, `redraw`) using Hono's `stream`/`streamText`. Auth (`signup/verify/forgot/reset/mfa/sessions/password`), blocks (CRUD + `messages/transcribe/write-note/narrate/export-pdf/track/explain-step/redraw`), canvases (CRUD + `share/share-link/share/[collaboratorId]/join/usage`), connections (CRUD), `link-preview`, `models`, `skills` (CRUD + `generate`), `usage/budget`, `user` (CRUD + `mfa/*`, `password`, `sessions`), `notifications` (list + `read`).
- **Middleware stack (order):** request-id + structured logging → CORS (allowlist, only in topology B) → `secureHeaders` (HSTS, frame-ancestors none, nosniff, referrer, **CSP** — closes the empty-`next.config` gap from `docs/PRD-auth-security-audit.md` F5) → body-size limits → auth (verify session, attach user) → CSRF (mutations) → rate-limit (per user/IP; move `lib/rateLimit.ts`, back it with a shared store for multi-instance) → zod request validation (from `packages/shared`) → handler.
- **DB:** import Prisma from `packages/db`. **Fix the pool** (`max: 1` → 10–20 — the P0 finding in `docs/PRD-performance-and-answer-rendering.md`).
- **AI & sensitive work (server-only, keys never leave):** all `hackai-sdk` usage (chat/generate, TTS, STT/Whisper, Exa, Gemini attachments, embeddings), the generation/verification pipeline, `link-preview` (with the SSRF guard), and `export-pdf` (react-pdf renders in Node — fine).
- **Env:** zod-validated env at boot (fail fast if a secret is missing); all secrets here only.
- **Production features:** `/healthz` + `/readyz`, graceful shutdown, timeouts, OpenTelemetry/Sentry hooks, per-route Server-Timing, and a typed contract (Hono RPC `AppType` export, or OpenAPI via `@hono/zod-openapi`).
- **Runtime:** Node (keeps react-pdf, pg, bcrypt working); Bun optional later.

### 5.2 `packages/db` & `packages/shared`
- **db:** `schema.prisma`, generated client, migrations; a single `PrismaClient` singleton with the corrected pool; consumed only by `server`.
- **shared:** the zod schemas + types both sides need — `GenerationEnvelope`/`SolutionStep`/`TableForm`, `Scene`/DSL types, request/response DTOs, `CanvasRole`, notification/enum types, and shared constants. **No server-only imports** so it's safe in the browser bundle.

### 5.3 `app` — Next.js (UI only) + base-URL API client
- **`packages/api-client`:** a single client keyed off `NEXT_PUBLIC_API_BASE_URL` that:
  - uses **Hono RPC (`hc<AppType>`)** for typed JSON calls (end-to-end types from the server), plus a thin **raw-fetch streaming layer** for NDJSON endpoints (reuse the existing reader in `lib/board/streamMessages.ts`, just point it at the base URL).
  - sends credentials correctly (same-origin in A; `credentials:'include'` in B), normalizes errors, maps 401 → the same redirect/login behavior as today, and works both in the browser and in RSC/SSR (a `serverApi()` variant that forwards `cookies()`).
- **Replace all 36 `fetch('/api/...')` sites** with the client. URLs change (`/api/x` → `${BASE}/x`), **behavior does not**.
- **Convert the 7 SSR pages** to fetch from the server via `serverApi()` (cookie-forwarded), and **remove the 2 direct Prisma imports**. Same rendered output, same SSR (no flash).
- **Delete `src/app/api/*` and Prisma/secret deps from web** once parity is verified.
- Keep `proxy.ts` middleware as the auth edge gate (local JWT verify).

### 5.4 Secrets & "talk only to our server" lockdown
- **Web bundle contains zero secrets** — verify with a build-time check (grep the client bundle for key names; fail CI if found). Only `NEXT_PUBLIC_API_BASE_URL` is public.
- **Every sensitive/AI/DB/preview call is server-side** (already true; now structurally enforced — web can't even import the SDK or Prisma).
- **Proxy remaining client→third-party calls through the server:** the Google **favicon** `img src` in `WebLinkNode` → a server route `/assets/favicon?domain=` (also removes a privacy leak + lets us cache). Audit the client for any other direct external fetch/image.
- **Document the allowed exceptions:** genuinely non-essential public assets (e.g. Google Fonts / KaTeX CSS) may stay, or self-host them for a fully first-party network tab. Goal: the browser Network panel shows **our server** (+ optional public fonts) and nothing else.

---

## 6. Data flow after the split (text diagram)
```
Browser ──(cookie, same-site)──▶  app (Next SSR/RSC + static)
   │                                   │  serverApi() forwards cookie (SSR only)
   │ api-client (base URL)             ▼
   └──────────────────────────▶  server (Hono)  ──▶  Prisma/Postgres
                                       │  (holds ALL secrets)
                                       ├──▶ hackai-sdk (chat / TTS / STT / Exa / Gemini)
                                       └──▶ link-preview (SSRF-guarded), react-pdf
```
The browser never holds a secret and never calls an AI/DB/third-party API directly.

---

## 7. Behavior-parity contract (binding — "no UX change")
Treat as regression tests; all must pass identically pre/post:
- Streaming answers/narration/explain-step/redraw stream token-by-token with the same timing, optimistic user message, "Creating diagram…" status, and diagram-node placeholder→real swap.
- All CRUD, sharing (invite/link/join/roles), notifications (bell, per-canvas scoping, mark read/unread), usage/budget, MFA/verify/reset flows behave identically, same status codes & error toasts.
- SSR pages (canvas, settings) render server-side with no new loading flash.
- Auth redirects (unauthed→/login, authed→/) unchanged; sessions persist; login/logout identical.
- Video/voiceover export, PDF export, transcription, web search, skills, @-mentions — all unchanged.
- Everything on the compatibility list in `docs/PRD-v2-production.md` §5.4.

---

## 8. Migration plan (strangler — incremental, reversible)
- **P0 — Monorepo scaffold.** Turborepo + pnpm workspaces; extract `packages/db` (Prisma) and `packages/shared` (types/zod). No behavior change; web still uses its own `/api`.
- **P1 — Stand up Hono `server`.** Health checks, env validation, middleware stack, DB via `packages/db`. Port routes **domain-by-domain** (start with read-only: `models`, `notifications`, `canvases` GET), verifying parity against the running Next routes. Run both in parallel; flip each domain via the base URL / rewrite (strangler) so you can roll back per-route.
- **P2 — Port auth to Hono.** Session issue/verify, MFA/verify/reset, sessions; wire Next middleware (local verify) + `serverApi()` for SSR. Land the `docs/PRD-auth-security-audit.md` P0 hardening here.
- **P3 — Base-URL client + cutover.** Ship `packages/api-client`; replace all 36 client fetch sites; convert the 7 SSR pages to `serverApi()`; move streaming readers to the base URL.
- **P4 — Remove web `/api` + Prisma + secrets.** Delete `src/app/api/*`, drop Prisma/SDK deps from web, add the CI secret-leak check.
- **P5 — Production hardening.** CORS/headers/CSP, pool fix, distributed rate-limit, logging/tracing, Docker for the server, separate CI/CD + deploy, secrets manager. Fold in the perf P0s from `docs/PRD-performance-and-answer-rendering.md`.
- **Rollback:** each phase is independently revertible; because P1–P3 run Next `/api` and Hono in parallel behind the base URL/rewrite, any domain can be flipped back instantly.

---

## 9. Risks & mitigations
- **Auth/session across the split (highest).** → same-site cookie + local JWT verify in middleware + `serverApi()` cookie-forwarding for SSR; cut auth over last (P2) after data routes are proven.
- **SSR pages losing direct DB access.** → server-to-server `serverApi()` preserves SSR; verify no loading flash.
- **Streaming cross-origin.** → topology A (same-origin) avoids it entirely; for B, CORS + `credentials` + confirmed chunked streaming.
- **NextAuth removal is large (MFA/verify/reset already built).** → port logic 1:1 to Hono reusing bcrypt/Prisma; optional interim "NextAuth-as-verifier" step.
- **Type drift during the move.** → `packages/shared` + Hono RPC types make server/client contracts compile-time-checked.
- **Prisma generated-client path / build.** → generate into `packages/db`; server-only import.
- **Accidental key exposure.** → CI check that the web bundle contains no secret names and doesn't import the SDK/Prisma.

---

## 10. Acceptance criteria
- AC1. Repo is a monorepo: `app`, `server` (Hono), `packages/{db,shared,api-client}`; both build & run via Turborepo.
- AC2. **All 38 routes** serve from Hono with identical contracts + streaming; web `src/app/api/*` is deleted.
- AC3. Auth (incl. MFA/verify/reset/sessions) runs on the server; login/session/redirect behavior is identical; sessions are `HttpOnly`+`SameSite`+`Secure`.
- AC4. The web app imports **no Prisma and no secrets**; a CI check proves the client bundle is secret-free; the browser Network panel shows only our server (+ optional public fonts).
- AC5. All AI/TTS/STT/Exa/Gemini/link-preview/PDF work runs server-side only; `HACKCLUB_AI_API_KEY` exists only in server env.
- AC6. The base-URL API client drives all client + SSR calls via `NEXT_PUBLIC_API_BASE_URL`; switching topology A↔B is one env var.
- AC7. **Zero UX/functional change** — the §7 parity suite passes; `docs/PRD-v2-production.md` §5.4 unregressed.
- AC8. Production features present: health checks, security headers/CSP, CORS (B), rate-limit, env validation, logging/tracing, DB pool fixed, Dockerized server + CI/CD.

## 11. Test plan
- **Parity E2E (Playwright, Chromium preinstalled):** run the full behavior suite against the *current* app, then against the split app; diff must be empty. Cover streaming, sharing/roles, notifications, MFA/auth, exports.
- **Contract tests:** typed client ↔ server (Hono RPC) compile + runtime schema checks from `packages/shared`.
- **Security:** the `docs/PRD-auth-security-audit.md` AC suite (SSRF, brute-force, headers, enumeration) now runs against Hono; CI secret-leak scan of the web bundle.
- **Perf:** confirm the pool fix + Server-Timing (`docs/PRD-performance-and-answer-rendering.md`).

---

## 12. Appendix — route → Hono mapping & sources
**Route groups to port (all under Hono):** `auth/*` (signup, verify, forgot-password, reset-password, mfa-check, [...nextauth]→Hono session), `blocks` (+ `[blockId]`, messages, narrate, transcribe, write-note, export-pdf, track, explain-step, redraw), `canvases` (+ `[canvasId]`, share, share-link, share/[collaboratorId], join, usage), `connections` (+ `[connectionId]`), `link-preview`, `models`, `skills` (+ `[skillId]`, generate), `usage/budget`, `user` (+ password, sessions, mfa/{setup,enable,disable}), `notifications` (+ read).
**Move to packages:** `lib/prisma` + `prisma/` → `packages/db`; `lib/ai/*`, `lib/board/{context,graphSync,webLinkSync,linkCheck,speech,videoExport…}`, `lib/canvasAccess`, `lib/rateLimit`, `lib/currentUser`, `auth.ts` → `server`; `lib/ai/envelope` types + `lib/dsl/types` + DTOs → `packages/shared`.

**Sources:**
- Next.js frontend + Hono BFF proposal: https://medium.com/@shinaps/proposal-for-the-combination-of-next-as-frontend-hono-as-bff-f91fc088fbfb
- Turborepo monorepo — Next + Hono in one repo: https://dev.to/iurii_rogulia/turborepo-monorepo-nextjs-15-frontend-hono-4-backend-in-one-repo-388
- Hono RPC (end-to-end typed client): https://hono.dev/docs/guides/rpc
- Hono RPC in monorepos (TS project references): https://catalins.tech/hono-rpc-in-monorepos/
- OAuth & cookies for browser-based apps (BFF, httpOnly): https://curity.io/resources/learn/oauth-cookie-best-practices/
- Securing JWT auth with httpOnly cookies: https://www.wisp.blog/blog/ultimate-guide-to-securing-jwt-authentication-with-httponly-cookies
