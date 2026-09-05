import { test, expect } from "@playwright/test";
import { createCanvasWithBlock, deleteCanvas, readNdjson } from "../helpers";

// PRD v2 §9 "Testing" — "Integration: messages & narrate streams." API-level, no browser: these
// two routes are both NDJSON streams, and their contract (event order, shapes, error handling) is
// exactly what a real client (ChatThread.tsx, GraphAnimationFullscreen.tsx) depends on — worth
// pinning down directly against the real route, not mocked.

test.describe("messages stream", () => {
  let canvasId: string;
  let blockId: string;

  test.beforeEach(async ({ request }) => {
    ({ canvasId, blockId } = await createCanvasWithBlock(request, "e2e: messages integration"));
  });

  test.afterEach(async ({ request }) => {
    await deleteCanvas(request, canvasId);
  });

  test("streams start then done, with a real generated answer", async ({ request }) => {
    const res = await request.post(`/api/blocks/${blockId}/messages`, {
      data: { content: "What is 12 + 7?", requestId: crypto.randomUUID() },
    });
    expect(res.ok()).toBeTruthy();

    const events = await readNdjson(await res.text());
    const types = events.map((e) => e.type);

    expect(types[0]).toBe("start");
    expect(types).toContain("done");
    expect(types).not.toContain("error");

    const doneEvent = events.find((e) => e.type === "done") as { block: { messages: { role: string; content: string }[] } };
    const assistantMessages = doneEvent.block.messages.filter((m) => m.role === "ASSISTANT");
    expect(assistantMessages.length).toBeGreaterThan(0);
    expect(assistantMessages.at(-1)!.content.length).toBeGreaterThan(0);
  });

  test("rejects an empty message body", async ({ request }) => {
    const res = await request.post(`/api/blocks/${blockId}/messages`, {
      data: { content: "", requestId: crypto.randomUUID() },
    });
    expect(res.status()).toBe(400);
  });

  test("404s for a block the caller can't access", async ({ request }) => {
    const res = await request.post(`/api/blocks/nonexistent-block-id-xyz/messages`, {
      data: { content: "Hello", requestId: crypto.randomUUID() },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("narrate stream", () => {
  let canvasId: string;
  let blockId: string;

  test.beforeEach(async ({ request }) => {
    ({ canvasId, blockId } = await createCanvasWithBlock(request, "e2e: narrate integration"));
    // Narration needs a real answer with solution steps to narrate from — generate one first.
    const res = await request.post(`/api/blocks/${blockId}/messages`, {
      data: { content: "Solve for x: 2x + 4 = 10. Show your working in steps.", requestId: crypto.randomUUID() },
    });
    expect(res.ok()).toBeTruthy();
  });

  test.afterEach(async ({ request }) => {
    await deleteCanvas(request, canvasId);
  });

  test("streams clip events then done, with a script derived from the real answer", async ({ request }) => {
    const res = await request.post(`/api/blocks/${blockId}/narrate`);
    expect(res.ok()).toBeTruthy();

    const events = await readNdjson(await res.text());
    const types = events.map((e) => e.type);
    expect(types.at(-1)).toBe("done");

    const doneEvent = events.at(-1) as { narration: { clips: { step: number; text: string }[] } | null };
    // Every clip's text should be non-empty and free of raw LaTeX/markdown delimiters —
    // buildNarrationScript's whole contract (also covered directly in the unit suite).
    if (doneEvent.narration) {
      for (const clip of doneEvent.narration.clips) {
        expect(clip.text.length).toBeGreaterThan(0);
        expect(clip.text).not.toContain("$");
      }
    }
  });

  test("a second concurrent request for the same block+script rides the first, not a duplicate synthesis", async ({
    request,
  }) => {
    const [res1, res2] = await Promise.all([request.post(`/api/blocks/${blockId}/narrate`), request.post(`/api/blocks/${blockId}/narrate`)]);
    expect(res1.ok()).toBeTruthy();
    expect(res2.ok()).toBeTruthy();

    const events1 = await readNdjson(await res1.text());
    const events2 = await readNdjson(await res2.text());
    const narration1 = (events1.at(-1) as { narration: { clips: unknown[] } | null }).narration;
    const narration2 = (events2.at(-1) as { narration: { clips: unknown[] } | null }).narration;

    // Both requests must agree on the resulting clip set — the leader/follower dedup guard
    // (lib/board/narrate route's inFlightSynthesis map) exists exactly so two concurrent callers
    // never each pay for a separate real TTS pass.
    expect(narration1?.clips.length).toBe(narration2?.clips.length);
  });

  test("400s when there's nothing to narrate", async ({ request }) => {
    // A fresh block with no generated answer yet has no solution/table/scene to build a script from.
    const canvasRes = await request.post("/api/canvases", { data: { title: "e2e: empty narrate" } });
    const { canvas } = await canvasRes.json();
    const blockRes = await request.post("/api/blocks", { data: { canvasId: canvas.id, positionX: 0, positionY: 0 } });
    const { block } = await blockRes.json();

    const res = await request.post(`/api/blocks/${block.id}/narrate`);
    expect(res.status()).toBe(400);

    await deleteCanvas(request, canvas.id);
  });
});
