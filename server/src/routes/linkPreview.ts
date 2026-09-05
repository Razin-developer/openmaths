import { Hono } from "hono";
import { checkUrl } from "@openmaths/db/board/linkCheck";

// Ported verbatim from app's src/app/api/link-preview/route.ts (PRD "Split into app + server" P4)
// — including its original lack of an auth check, which this port deliberately preserves rather
// than silently tightening (checkUrl is already SSRF-hardened; changing the auth surface of an
// existing route is a separate decision from moving it).
export const linkPreviewRoutes = new Hono();

linkPreviewRoutes.get("/link-preview", async (c) => {
  const rawUrl = c.req.query("url") ?? "";

  const result = await checkUrl(rawUrl);
  if (!result) return c.json({ error: "Invalid URL" }, 400);

  return c.json(result);
});
