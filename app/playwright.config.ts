import { defineConfig, devices } from "@playwright/test";

// PRD v2 §9 "Testing": "Integration: messages & narrate streams. E2E (Playwright — Chromium is
// preinstalled): ask → forms render → narrate → export." One config covers both tiers — API-level
// integration specs (e2e/integration/*.spec.ts, using Playwright's `request` fixture, no browser)
// and real-browser E2E specs (e2e/*.spec.ts) — since they need the exact same running server and
// the same test-account credentials, splitting frameworks would just duplicate that setup.
//
// Requires the app already running against a local dev database seeded via
// `SEED_CONFIRM=1 pnpm exec tsx scripts/seed-test.ts` (creates test@openmaths.dev). `webServer`
// reuses an already-running `pnpm dev` rather than starting a second one when developing locally;
// CI would want reuseExistingServer: false so it always starts fresh.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // shares the one seeded test account across specs; avoid cross-test races
  retries: 0,
  workers: 1,
  reporter: "list",
  // Logs in ONCE for the whole run and writes e2e/.auth/user.json — see the file's own doc
  // comment for why this isn't just a speed optimization (F3's real login rate limit).
  globalSetup: "./e2e/global-setup.ts",
  // Real AI generation in this app has been observed taking 40-100+s for a single answer (self-
  // check verification adds a second full completion call on top of the first) — several specs
  // here generate for real, not against a mock, so the default needs real headroom, not the
  // Playwright default's 30s.
  timeout: 180_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState: "e2e/.auth/user.json",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
