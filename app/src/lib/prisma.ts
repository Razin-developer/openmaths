// Relocated to packages/db (PRD "Split into app + server" P0) — this file is now a thin re-export
// so every existing `@/lib/prisma` import site in this app needs no changes. The pooled-singleton
// logic itself now lives in packages/db/src/index.ts, shared with `server` starting P1.
export { prisma } from "@openmaths/db";
