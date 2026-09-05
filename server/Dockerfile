# Build context is the monorepo root (`docker compose build` / `docker build -f server/Dockerfile .`)
# — this stage needs `packages/db` and `packages/shared` alongside `server/`, not just `server/`
# itself, since pnpm resolves `@openmaths/*` workspace deps by real path, not a registry.

FROM node:22-alpine AS base
# pnpm checks this to skip interactive prompts (e.g. the "reinstall from scratch?" confirmation a
# `pnpm prune` used to trigger here) — real CI sets it automatically, but a `docker build` doesn't
# inherit the host shell's env at all, so without this a prompt like that hangs forever waiting on
# stdin no CI runner ever connects (found the hard way: a real GitHub Actions run hit exactly this
# and ran until the 6-hour job timeout killed it). Kept even after removing the `prune` step below
# (see the runner stage) since it's cheap insurance against any other pnpm command doing the same.
ENV CI=true
RUN corepack enable
WORKDIR /repo

# `build` also doubles as the `migrate` compose service's image (see docker-compose.yml).
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
# Deliberately NOT `pnpm prune --prod` here: a real CI run caught it silently breaking `server`'s
# own `node_modules/.bin/tsx` symlink (the pruned image booted, but `pnpm start` then failed with
# `sh: tsx: not found`) on top of the interactive-prompt hang the `ENV CI=true` above already fixed
# once. Two independent failure modes from the same "optimization" is enough — trading some image
# size for an image that actually boots.
WORKDIR /repo/server
EXPOSE 4000
CMD ["pnpm", "start"]
