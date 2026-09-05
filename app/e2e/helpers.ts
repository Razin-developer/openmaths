import type { APIRequestContext } from "@playwright/test";

/** The seeded test account (scripts/seed-test.ts) — same one used throughout manual testing this
 * project. Not a secret worth an env var: it only exists in a local dev DB behind SEED_CONFIRM=1,
 * never in a real deployment. */
export const TEST_EMAIL = "test@openmaths.dev";
export const TEST_PASSWORD = "TestUser12345!";

/** Logs the given API request context in as the seeded test user via NextAuth's credentials
 * callback — the context's cookie jar (Playwright manages this automatically per APIRequestContext)
 * then carries the session for every subsequent request/page navigation made with it. Shared by
 * both integration specs (raw `request` fixture) and E2E specs (via `page.request`, which uses the
 * same jar the browser page does, so logging in this way also authenticates the UI). */
export async function login(request: APIRequestContext, email = TEST_EMAIL, password = TEST_PASSWORD): Promise<void> {
  const csrfRes = await request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  const res = await request.post("/api/auth/callback/credentials", {
    form: { email, password, csrfToken, json: "true" },
  });
  if (!res.ok()) {
    throw new Error(`Login failed for ${email}: ${res.status()} ${await res.text()}`);
  }
}

/** Creates a fresh canvas + a QUESTION block via the real API, for a test to ask into. Returns
 * both ids so the test/cleanup can address them directly. */
export async function createCanvasWithBlock(
  request: APIRequestContext,
  title: string
): Promise<{ canvasId: string; blockId: string }> {
  const canvasRes = await request.post("/api/canvases", { data: { title } });
  const { canvas } = await canvasRes.json();
  const blockRes = await request.post("/api/blocks", {
    data: { canvasId: canvas.id, positionX: 0, positionY: 0 },
  });
  const { block } = await blockRes.json();
  return { canvasId: canvas.id, blockId: block.id };
}

/** Deletes a canvas (and everything on it) — every spec should clean up what it creates, matching
 * this whole project's established pattern for throwaway test data. */
export async function deleteCanvas(request: APIRequestContext, canvasId: string): Promise<void> {
  await request.delete(`/api/canvases/${canvasId}`);
}

/** Parses one of this app's NDJSON streaming responses (the /messages and /narrate routes both
 * use this exact wire format: one JSON object per line) into an array of events. */
export async function readNdjson(body: string): Promise<Record<string, unknown>[]> {
  return body
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}
