# openmaths

[![CI](https://github.com/Razin-developer/openmaths/actions/workflows/ci.yml/badge.svg)](https://github.com/Razin-developer/openmaths/actions/workflows/ci.yml)

AI-drawn, step-by-step math canvas — ask a question, get a worked solution with an animated,
narrated diagram alongside it, on an infinite canvas you can branch, annotate, and share.

## Monorepo layout

A pnpm/Turborepo workspace, split into a UI-only Next.js app and a separate Hono API server that
owns every database/auth/AI call and secret (see
[`docs/PRD-split-nextjs-app-and-hono-server.md`](docs/PRD-split-nextjs-app-and-hono-server.md) for
the full rationale and migration history).

```
app/                  Next.js 16 (App Router) UI — no direct DB access except auth.ts's own
                       Edge Middleware session check (see the PRD above for why that one stays)
server/                Hono API — sessions, Prisma, rate limiting, AI generation, everything else
packages/
  db/                   Prisma schema + generated client + shared query helpers
  shared/               Framework-agnostic types/schemas used by both app and server
  api-client/           Typed fetch client app talks to server through
  components/           Shared UI primitives (shadcn-based)
docs/                   Feature PRDs — the closest thing this repo has to a product spec
```

## Getting started

```bash
pnpm install
npx prisma dev          # local Postgres, from packages/db
pnpm dev                 # runs app (:3000) + server (:4000) together, via turbo
```

Copy each package's `.env.example` to `.env` and fill in `DATABASE_URL`, `AUTH_SECRET` (any random
string in dev), and `HACKCLUB_AI_API_KEY` ([ai.hackclub.com](https://ai.hackclub.com/dashboard) —
free for teens 18 and under).

## Docker

```bash
cp .env.example .env    # fill in AUTH_SECRET / HACKCLUB_AI_API_KEY
docker compose up --build
```

Boots Postgres, runs migrations, then `server` (`:4000`) and `app` (`:3000`).

## Testing

```bash
pnpm turbo run typecheck lint test build
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same, plus a Docker build and
a full `docker compose` smoke test, on every push and pull request.
