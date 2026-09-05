# openmaths — PRD: Authentication & Security Audit + Hardening

| | |
|---|---|
| **Product** | openmaths — AI math explainer (Next.js 16 · NextAuth/Auth.js v5 · Prisma/Postgres) |
| **Version** | 1.0 |
| **Author** | Razin (with Claude) |
| **Date** | 2026-08-20 |
| **Audience** | Claude Code (implementing agent) working in this repo |
| **Scope** | A security audit of the **entire auth surface** — authn, session, authorization/roles, SSRF, secrets, headers, rate-limiting, CSRF — with severity-ranked findings, fixes, a market comparison, and a hardening roadmap. |

> This is an **audit-and-plan**, delivered as a PRD (not a live code edit — Claude Code owns the repo). Every finding cites the real file. Severity uses OWASP-style impact×likelihood. Fix nothing production-facing without the P0 items in §4.

---

## 1. Current auth architecture (code-derived)
- **Auth.js/NextAuth v5**, **Credentials** provider only (email + password), **JWT** session strategy, `trustHost: true`, sign-in page `/login` (`src/auth.ts`).
- **Passwords**: `bcryptjs` cost **10**; min length **8** (signup `z`, password-change manual) (`auth/signup/route.ts`, `user/password/route.ts`).
- **Route protection**: `src/proxy.ts` (Next 16's middleware) runs `auth()`, redirects unauthed → `/login`, authed → `/` off public routes; matcher covers everything but static assets. Routes **re-verify** via `getCurrentUser()` (`lib/currentUser.ts`, throws `UnauthorizedError` → 401).
- **Authorization**: `canvasAccessWhere` (owner OR collaborator-by-email) for visibility; `resolveCanvasRole`/`requireCanvasRole` (OWNER>EDITOR>COMMENTER>VIEWER) for mutations (`lib/canvasAccess.ts`). Applied on blocks, connections, messages, transcribe, write-note.
- **Rate limiting**: in-memory sliding window (`lib/rateLimit.ts`), applied to `messages` and `narrate` only.
- **Secrets**: `.env` gitignored (`.env*`); `HACKCLUB_AI_API_KEY` + `AUTH_SECRET` server-only; API key never reaches the client.
- **Sharing identity = email** (unverified): `canvasAccessWhere` grants access to anyone whose **email** matches a collaborator row; signup **backfills pending invites** for that email.

---

## 2. Findings — summary table (severity-ranked)
| # | Severity | Finding | Location |
|---|---|---|---|
| F1 | **High** | Unverified email + email-based access → **invite/canvas takeover** | `canvasAccessWhere`, `auth/signup/route.ts` |
| F2 | **High** | **SSRF** via server-side fetch of arbitrary user URLs (no private-IP block, follows redirects) | `lib/board/linkCheck.ts`, `api/link-preview` |
| F3 | **High** | **No brute-force protection / rate-limit on login** (credentials has none built-in) | `src/auth.ts` |
| F4 | Medium | **User enumeration** — signup 409 "email exists" + login **timing oracle** (no dummy bcrypt on missing user) | `auth/signup/route.ts`, `auth.ts` `authorize` |
| F5 | Medium | **Missing security headers / CSP** (clickjacking, MIME-sniff, HSTS, referrer) | `next.config.ts` (empty) |
| F6 | Medium | **Viewer can trigger paid TTS** (`/narrate`) on a shared canvas — cost abuse (not role-gated) | `api/blocks/[id]/narrate/route.ts` |
| F7 | Medium | **GET share-link redemption has side effects** (grants access) → CSRF/prefetch redeem | `canvas/[canvasId]/page.tsx` |
| F8 | Medium | **JWT sessions can't be revoked** — no "log out everywhere"; password change doesn't invalidate other sessions | `auth.ts` |
| F9 | Medium | **No body/attachment size limits** on data-URL uploads (image/PDF/audio) → DoS + cost | `messages`, `transcribe` routes |
| F10 | Medium | **Verify owner-gating** on collaborator-removal / share-link routes (authz) | `api/canvases/[id]/share/[collaboratorId]`, `share-link` |
| F11 | Medium | Rate limiter is **in-memory / per-process** — bypassable on multi-instance; resets on restart | `lib/rateLimit.ts` |
| F12 | Low | bcrypt cost **10** (bump to 12); **no breached-password check**; no password composition guidance (NIST) | signup / password routes |
| F13 | Low | **No MFA**, **no email verification**, **no password reset** flow | product-wide |
| F14 | Low | Password-change route **skips current-password check** when `passwordHash` is null | `user/password/route.ts` |
| F15 | Low | `next-auth@5.0.0-beta.32` (beta in prod) — track for security patches | `package.json` |

---

## 3. Findings — detail & fixes

### F1 (High) — Unverified email = invite/canvas takeover
`canvasAccessWhere` grants a canvas to **anyone whose account email matches a collaborator row**, and email is **never verified**. So if an owner shares to `alice@school.edu` before Alice has registered, **an attacker who registers `alice@school.edu` first inherits that access** (and signup even flips the pending invite to ACTIVE + notifies them). Email is being used as an access key without proving ownership of it.
**Fix:** require **email verification** before an account can be used to claim email-based shares (verify-on-signup token, or verify before granting invite access); alternatively bind invites to a verified account id at acceptance time. Until email infra exists, at minimum **don't auto-grant** an unverified new account access to canvases shared to that email — require an explicit accept step and flag unverified accounts.

### F2 (High) — SSRF via link fetching
`checkUrl` (used by `/api/link-preview` and the web-search LINK sync) fetches **any** user-supplied `http(s)` URL server-side with `redirect: "follow"` and **no private-network guard** — an attacker can point it at `http://169.254.169.254/…` (cloud metadata), `http://localhost:…`, `10./192.168./[::1]` internal services; status + `<title>` come back to the client (limited exfil, plus internal port-scanning).
**Fix:** resolve the host and **block private/loopback/link-local/reserved ranges** (and IPv6 equivalents) before fetching; **disallow non-80/443 ports**; **limit redirects** and re-validate each hop's IP (guard against DNS-rebinding/redirect bypass); cap response size and time (timeout exists). Consider an allowlist or a dedicated egress proxy.

### F3 (High) — Login brute-force
The Credentials `authorize` has **no throttling/lockout**, and `checkRateLimit` isn't applied to auth. An attacker can spray passwords unbounded.
**Fix:** rate-limit login attempts **per IP and per account** (progressive backoff), add **temporary lockout** after N failures, and log/alert on bursts. Apply the same to signup and password-change. Move to a **distributed** limiter (F11) for real deployments; add bot defense (CAPTCHA/Turnstile) on repeated failures.

### F4 (Medium) — User enumeration
Signup returns **409 "An account with that email already exists"** (confirms registered emails), and `authorize` returns `null` **before** doing bcrypt when the user is missing → a **timing oracle** distinguishes existing vs non-existing accounts.
**Fix:** In `authorize`, always run a `bcrypt.compare` against a **dummy hash** when the user/hash is absent, so timing is constant. For signup, prefer a **neutral response** (or, once email exists, "we've sent a verification email" regardless). Keep messages generic on login ("Invalid email or password").

### F5 (Medium) — Missing security headers / CSP
`next.config.ts` is empty → no `Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors` (clickjacking — the canvas can be framed), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, or CSP.
**Fix:** add a `headers()` block (or middleware) with HSTS, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy`, and a **CSP** tuned for the app (self + `fonts.googleapis/gstatic`, the Google favicon host, `blob:`/`data:` for WebGL/exports, HackClub AI for fetches). Start report-only, then enforce.

### F6 (Medium) — Viewer-triggered paid generation
`/narrate` checks only `canvasAccessWhere` (any collaborator, incl. **Viewer**) and spends real TTS/Replicate cost + writes `Block.narration`. A viewer on a shared canvas can run up the owner's/actor's cost.
**Fix:** gate `/narrate` behind at least a role that's allowed to spend (editor, or a dedicated "can generate" check), keep the per-user rate limit, and attribute/limit cost per the `docs/PRD-user-system-usage-notifications.md` budget model. Audit `export-pdf`/`track` similarly (read-only is fine; anything that costs money or writes should be gated).

### F7 (Medium) — Side-effecting GET (share redemption)
Visiting `/canvas/[id]?share=token` **grants standing access** (upserts a collaborator) — a state change on a **GET**, which is CSRF-prone and can be triggered by link prefetch/scanners.
**Fix:** make redemption an explicit **POST** (a "Join canvas" confirmation), or require the redeemer to click a button; keep it idempotent and honor link `role`/`expiresAt` (already in the model).

### F8 (Medium) — Non-revocable sessions
JWT sessions can't be invalidated server-side: **password change / "log out everywhere" don't kill existing sessions**, and a stolen token is valid until expiry.
**Fix:** shorten session `maxAge` + rotate, and/or add a **session/token-version** claim bumped on password change & explicit "sign out all devices" (compared in the `jwt`/`session` callback), or move to **DB sessions** for true revocation. Set an explicit idle + absolute timeout.

### F9 (Medium) — Upload size limits
Image/PDF/audio are sent as **base64 data URLs** in JSON bodies with no explicit cap → large-payload DoS and inflated model cost.
**Fix:** enforce per-attachment and per-request size limits (server-side reject + client pre-check), and cap counts. Validate declared vs actual MIME.

### F10 (Medium) — Verify sharing authz
Confirm collaborator-removal (`share/[collaboratorId]` DELETE) and `share-link` create/revoke are **owner-only** (they should use an ownership/owner-role check, not just `canvasAccessWhere`). If a non-owner collaborator can remove collaborators or mint links, that's privilege escalation.
**Fix:** gate all sharing-management routes on `requireCanvasRole(..., "owner")`.

### F11–F15 (Medium/Low)
- **F11:** replace the in-memory limiter with a shared store (Redis/Upstash) for any multi-instance deploy; today's Map silently resets and doesn't coordinate across processes.
- **F12:** bump bcrypt to **cost 12**; add a **breached-password check** (k-anonymity HIBP range API) and NIST-aligned guidance (length over composition, block common passwords), keep the 8-char floor but encourage longer.
- **F13:** add **email verification**, optional **TOTP MFA**, and a **password-reset** flow (needs email infra) — table stakes for a real product (and required to safely fix F1).
- **F14:** in password change, when there's no existing hash, require a verified re-auth path rather than silently allowing a set (latent risk if OAuth is ever added).
- **F15:** pin/track `next-auth` beta for security releases; plan the move to a stable release before GA.

---

## 4. Remediation roadmap
- **P0 (before any real users):** F1 (email verification / don't auto-grant), F2 (SSRF guard), F3 (login rate-limit + lockout), F4 (enumeration/timing), F10 (verify sharing authz).
- **P1:** F5 (headers/CSP), F6 (gate paid generation), F7 (POST redemption), F9 (upload limits), F11 (distributed limiter).
- **P2:** F8 (session revocation / logout-everywhere), F12 (bcrypt 12 + breached-password), F14.
- **P3:** F13 (MFA, password reset), F15 (auth dependency upgrade), audit logging for auth events.

---

## 5. Market comparison — how real products do auth
Real SaaS rarely hand-rolls credentials auth; they either **harden a full stack** or **adopt a managed identity provider**. What the market ships (Clerk, Auth0, Supabase Auth, WorkOS, Firebase Auth):

| Capability | openmaths today | Market standard |
|---|---|---|
| Email verification | ❌ (email trusted unverified) | ✅ required before access |
| Brute-force / bot protection | ❌ | ✅ rate-limit, lockout, bot detection |
| Enumeration-safe responses | ❌ | ✅ neutral messages, constant time |
| MFA / passkeys | ❌ | ✅ TOTP + WebAuthn/passkeys |
| Password reset | ❌ | ✅ email-based reset |
| Breached-password check | ❌ | ✅ HIBP / provider built-in |
| Session revocation | ❌ (JWT) | ✅ server sessions / device management |
| Security headers + CSP | ❌ | ✅ secure defaults |
| SSO / SCIM (teams) | ❌ | ✅ for B2B tiers |
| Audit logs | partial (ActivityEvent) | ✅ auth event log |

**Recommendation (build-vs-buy):** the custom NextAuth-credentials stack is fine to keep for a hackathon/MVP, but for a **real product handling students' data**, either (a) complete the P0–P2 hardening above *and* add email verification + reset + MFA, or (b) **adopt a managed provider** (Clerk / Auth0 / Supabase Auth) that ships verification, MFA, brute-force defense, breached-password checks, session management, and secure headers by default — which also removes the F1/F3/F4/F13 classes wholesale. Given sharing is **email-identity-based**, verified email is non-negotiable; a managed provider is the fastest safe path.

---

## 6. Acceptance criteria & test plan
- AC1 (F1): a newly-registered, **unverified** account cannot access a canvas shared to its email until verified/accepted; registering someone else's email grants nothing.
- AC2 (F2): `checkUrl`/link-preview **refuses** private/loopback/link-local/reserved hosts and non-80/443 ports, and re-validates redirects; an SSRF probe to `169.254.169.254` fails.
- AC3 (F3): N failed logins per IP/account trigger backoff/lockout; automated tests confirm throttling; signup/password-change likewise limited.
- AC4 (F4): login timing is constant for existing vs missing accounts (dummy compare); signup/login responses don't confirm account existence.
- AC5 (F5): security headers present (HSTS, frame-ancestors none, nosniff, referrer, CSP) — verified by an automated header test; app still functions (WebGL, fonts, favicons, exports).
- AC6 (F6/F10): Viewer cannot trigger `/narrate` or any paid/mutating action; only owners manage sharing (403 otherwise) — E2E asserted (extends `docs/PRD-sharing-collaboration.md` §9).
- AC7 (F7): share redemption is a POST/explicit action; a prefetch/GET does not grant access.
- AC8 (F8): "sign out all devices" and password change invalidate other sessions.
- AC9 (F9): oversized uploads are rejected server-side with a clear error.
- **Verification:** a lightweight security test suite (auth/authz/SSRF/headers) in CI; run `engineering:code-review` / `operations:risk-assessment` skills on the auth diff; no regression to `docs/PRD-v2-production.md` §5.4.

---

## 7. File index & sources
**Change:** `src/auth.ts` (dummy-compare, session versioning/maxAge, login limiter hook), `src/app/api/auth/signup/route.ts` (rate-limit, neutral responses, verification), `src/app/api/user/password/route.ts` (limiter, re-auth branch, cost 12, session bump), `src/proxy.ts` (defense-in-depth), `next.config.ts` (headers + CSP), `src/lib/board/linkCheck.ts` (SSRF guard) + `src/app/api/link-preview/route.ts`, `src/lib/canvasAccess.ts` + sharing routes (owner gating, verified-email access), `src/app/api/blocks/[blockId]/narrate/route.ts` (role gate), `src/lib/rateLimit.ts` (distributed backend), `src/app/canvas/[canvasId]/page.tsx` (POST redemption), attachment size limits in `messages`/`transcribe`, new email-verification/reset/MFA flows.

**Sources:**
- OWASP ASVS v4 — Authentication (V2): https://github.com/OWASP/ASVS/blob/master/4.0/en/0x11-V2-Authentication.md
- NIST password guidelines 2026 (length over composition, breached-password checks): https://securitycomplianceguide.com/blog/nist-password-guidelines/
- B2B SaaS auth best practices — a security engineer's checklist (2026): https://securityboulevard.com/2026/05/user-authentication-best-practices-for-b2b-saas-in-2026-a-security-engineers-checklist/
- Next.js security checklist 2026 (auth, API, CSRF, XSS) — TurboStarter: https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2026-authentication-api-protection-and-best-practices
- NextAuth.js security best practices — @rnab: https://arnab-k.medium.com/enhancing-authentication-security-nextauth-js-best-practices-3be3ec7100d2
- Next.js authentication guide 2026 — Clerk: https://clerk.com/articles/nextjs-authentication-guide-2026
