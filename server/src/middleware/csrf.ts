import { createMiddleware } from "hono/factory";
import { env } from "../env";

/**
 * PRD "Split into app + server" §4.3 — cookie-auth mutations need CSRF protection beyond
 * `SameSite`. This is the "Origin/Fetch-Metadata check" option the PRD explicitly names as
 * sufficient (the simpler alternative to a double-submit token): reject any state-changing
 * request whose `Origin` header isn't the app's own allowed origin. A cross-site page trying to
 * trigger a cookie-bearing mutation here would either omit `Origin` in a way this catches, or
 * send the wrong one — a same-origin/same-site XHR from `app` always sends the real one.
 * GET/HEAD/OPTIONS are exempt (never mutate, nothing to protect).
 */
const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const csrfMiddleware = createMiddleware(async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header("origin");
    if (!origin || !allowedOrigins.includes(origin)) {
      return c.json({ error: "Invalid origin" }, 403);
    }
  }
  await next();
});
