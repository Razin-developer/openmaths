# Build context is the monorepo root — `app` resolves `@openmaths/*` workspace packages by real
# path (see next.config.ts's `outputFileTracingRoot`), not just its own directory.

FROM node:22-alpine AS base
# See server/Dockerfile's own comment on this — pnpm skips interactive prompts when it sees this,
# and a `docker build` never inherits the host shell's env (including real CI's own `CI=true`) the
# way a plain `RUN` on the host would.
ENV CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS build
# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time, not read at container
# start — this must be a build ARG (docker-compose.yml's `app.build.args`), not just a runtime
# `environment:` entry, or the browser bundle silently keeps whatever default this falls back to.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
COPY . .
RUN pnpm install --frozen-lockfile
# auth.ts (bundled into proxy.ts's Edge Middleware) imports @openmaths/db for its own real,
# independent Prisma query — app's build fails without the generated client present first, same
# as server's.
RUN pnpm --filter @openmaths/db run build
RUN pnpm --filter app run build

# Next's `output: "standalone"` build already traces and copies just the files this needs
# (including `@openmaths/*` source, which Turbopack inlines directly into the compiled chunks —
# confirmed empirically, not assumed: the standalone folder has zero references to packages/db or
# packages/shared, and boots and serves real pages standalone). No pnpm/node_modules copying
# needed here at all — this is what makes the runtime image small.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /repo/app/.next/standalone ./
COPY --from=build /repo/app/public ./app/public
COPY --from=build /repo/app/.next/static ./app/.next/static
EXPOSE 3000
CMD ["node", "app/server.js"]
