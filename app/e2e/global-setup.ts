import { request as pwRequest } from "@playwright/test";
import { login, TEST_EMAIL, TEST_PASSWORD } from "./helpers";

/**
 * Logs in ONCE for the entire test run and saves the resulting session cookie to disk
 * (`storageState`) — referenced by every project's `use.storageState` in playwright.config.ts, so
 * every spec/test starts already authenticated instead of calling `login()` itself.
 *
 * This isn't just a speed optimization: F3 (PRD "Auth & Security Audit") rate-limits login to 5
 * attempts per 15 minutes per email — a suite that logs in fresh in every test's `beforeEach`
 * trips that real security control after a handful of tests and starts failing for a reason
 * that has nothing to do with what each test is actually checking. One login per run keeps the
 * suite well under that budget regardless of how many spec files/tests exist.
 */
export default async function globalSetup(): Promise<void> {
  const context = await pwRequest.newContext({ baseURL: "http://localhost:3000" });
  await login(context, TEST_EMAIL, TEST_PASSWORD);
  await context.storageState({ path: "e2e/.auth/user.json" });
  await context.dispose();
}
