import { defineConfig } from "vitest/config";
import path from "path";

// Unit-test config for the pure/isomorphic helpers named explicitly in
// docs/PRD-v2-production.md §9 ("Testing"): envelope parse/shim, resolveScene, expr,
// toSpeechText, CAS checks. Deliberately narrow — no jsdom, no React Testing Library, no
// database — these are all plain functions with no side effects, so a plain Node
// environment is the right (and fastest) fit. Server-only modules (routes, prisma-backed
// code) aren't unit-testable this way; that's still a real gap, noted in the PRD audit.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
