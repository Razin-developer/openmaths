# Build context is the monorepo root (`docker compose build` / `docker build -f server/Dockerfile .`)
# — this stage needs `packages/db` and `packages/shared` alongside `server/`, not just `server/`
# itself, since pnpm resolves `@openmaths/*` workspace deps by real path, not a registry.

FROM node:22-alpine AS base
# pnpm checks this to skip interactive prompts (e.g. "reinstall from scratch?" before `pnpm
# prune`) — real CI sets it automatically, but a `docker build` doesn't inherit the host shell's
# env at all, so without this the prune step below hangs forever waiting on stdin no CI runner
# ever connects (found the hard way: a real GitHub Actions run hit this and ran until the 6-hour
# job timeout killed it).
ENV CI=true
RUN corepack enable
WORKDIR /repo

# `build` also doubles as the `migrate` compose service's image (see docker-compose.yml) — it
# still has the `prisma` CLI (a devDependency of packages/db), which the pruned runtime image
# below deliberately drops.
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# Generates packages/db/generated/prisma — gitignored, and the one real build step this repo
# needs before `server` can run (see server/package.json: `start` runs the TS source directly via
# tsx, same as `dev`, since a plain `tsc` build here produces a dist/ that can't actually resolve
# `@openmaths/db`'s workspace-package export map at runtime — that map points at real .ts source
# files, which only a TS-aware runtime like tsx can load).
RUN pnpm --filter @openmaths/db run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /repo /repo
# Strips devDependencies workspace-wide now that prisma generate has already run — safe, its
# output already exists on disk. `server`'s own `tsx` stays; it was moved to a real (non-dev)
# dependency for exactly this image (see server/package.json).
RUN pnpm prune --prod
WORKDIR /repo/server
EXPOSE 4000
CMD ["pnpm", "start"]
