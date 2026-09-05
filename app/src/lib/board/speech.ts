// Relocated to packages/shared (PRD "Split into app + server" P3-continued round 6) — pure,
// framework-agnostic and used from both server routes and client code (MessageBubble's
// read-aloud, narrationStore) — thin re-export so every existing `@/lib/board/speech` import site
// needs no changes.
export * from "@openmaths/shared/speech";
