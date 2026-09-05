// Relocated to packages/db (PRD "Split into app + server" P1 — read-only routes ported to Hono
// need this same access logic, so it moved to where both `app` and `server` can share it) — thin
// re-export so every existing `@/lib/canvasAccess` import site in this app needs no changes.
export * from "@openmaths/db/canvasAccess";
