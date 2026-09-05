import { test, expect } from "@playwright/test";
import { deleteCanvas } from "./helpers";

// PRD v2 §9 "Testing" — "E2E (Playwright — Chromium is preinstalled): ask → forms render →
// narrate → export." One real browser, one real generation, following the exact named flow.
// Authenticated via the shared storageState (see global-setup.ts) rather than driving the login
// form itself, since the login FORM isn't what this flow is testing; a dedicated auth E2E spec
// would be the place for that (and would need its own un-authenticated browser context).

let canvasId: string | undefined;

test.afterEach(async ({ request }) => {
  if (canvasId) await deleteCanvas(request, canvasId);
  canvasId = undefined;
});

test("ask a geometry question → answer + diagram render → narrate → export is available", async ({ page }) => {
  // Chains three real, sequential AI calls end to end (stage-1 answer, stage-2 diagram, then
  // narration synthesis) — live-observed at up to ~106s for generation alone before this test was
  // even written; the config's 180s default doesn't leave enough room for everything after it.
  // Live-observed generation time for this exact flow ranged from ~80s to ~2.6min per stage
  // across several runs while writing this test — the shared free-tier AI backend's own latency
  // varies a lot run to run, independent of anything in this app, and this flow chains THREE real
  // stages (answer, diagram, narration synthesis) end to end. 15 minutes gives real headroom for
  // a slow-but-successful run without masking an actually-hung one.
  test.setTimeout(900_000);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "New canvas" }).click();
  await page.waitForURL(/\/canvas\//);
  canvasId = page.url().split("/canvas/")[1];

  // "ask"
  await page.getByRole("button", { name: "Ask your first question" }).click();
  const textarea = page.getByPlaceholder(/Ask a math question/);
  await textarea.click();
  await textarea.fill(
    "A right triangle has legs of length 3 and 4. Find the length of the hypotenuse, and draw the triangle labeled with all three side lengths."
  );
  await page.getByRole("button", { name: "Send" }).click();
  // Confirms the send actually happened (vs. matching leftover text still sitting in the prompt
  // box, unsent) — once a block has its first message, PromptInput.tsx's placeholder switches
  // from "Ask a math question…" to "Reply…", so the original locator stops resolving to anything.
  await expect(page.getByPlaceholder(/Ask a math question/)).toHaveCount(0, { timeout: 10_000 });

  // "forms render" — the structured solution steps and the connected diagram node both show up.
  // The disclaimer only renders alongside a real completed `solution[]` (SolutionSteps.tsx) —
  // a much more specific signal than matching arbitrary words that could also appear unsent.
  await expect(page.getByText("AI can make mistakes")).toBeVisible({ timeout: 300_000 });
  // xyflow (@xyflow/react) tags each node with a `react-flow__node-<type>` class, not a
  // data-testid — GRAPH-kind blocks render via the `graphBlock` node type (Board.tsx's
  // blockToNode / BoardCanvas.tsx's nodeTypes map). The diagram is a genuinely separate stage-2
  // call, fired only after the stage-1 answer above finishes, so it gets its own wait rather than
  // assuming it's already there the instant the answer is.
  const diagramNode = page.locator(".react-flow__node-graphBlock").first();
  await expect(diagramNode).toBeVisible({ timeout: 120_000 });

  // The diagram must actually paint something, not just mount an empty canvas — this is the
  // exact regression this session found and fixed (BlockCanvas's frameloop/sizing bug). The
  // node appearing in the DOM and the WebGL canvas having painted its first real frame are two
  // different moments — poll rather than sampling once immediately on mount, which raced the
  // render loop's first tick in earlier runs of this exact test.
  const canvasHandle = await diagramNode.locator("canvas").first().elementHandle();
  await expect
    .poll(
      async () =>
        page.evaluate((canvasEl) => {
          const canvas = canvasEl as HTMLCanvasElement;
          const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
          if (!gl || canvas.width === 0 || canvas.height === 0) return false;
          const pixels = new Uint8Array(4 * canvas.width * canvas.height);
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          return pixels.some((p) => p !== 0);
        }, canvasHandle),
      { timeout: 15_000, message: "diagram canvas never painted any non-zero pixels" }
    )
    .toBe(true);

  // "narrate" — open the fullscreen player and turn narration on.
  await diagramNode.getByRole("button", { name: "Animate" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /narrat/i }).click();
  // Narration synthesizes real TTS clips (a real Replicate call per step) — generous timeout.
  await expect(dialog.getByRole("button", { name: /narrat/i })).toHaveAttribute("aria-pressed", "true", {
    timeout: 120_000,
  });

  // "export" — the export control is present and enabled (not actually downloading a video here;
  // that's slow and the download itself is covered by the export buttons' own live wiring, not
  // this flow-shape test).
  const exportButton = dialog.getByRole("button", { name: "Export" });
  await expect(exportButton).toBeVisible();
  await expect(exportButton).toBeEnabled();

  await page.keyboard.press("Escape");
});
