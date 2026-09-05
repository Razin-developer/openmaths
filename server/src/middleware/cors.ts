import { cors } from "hono/cors";
import { env } from "../env";

/**
 * Topology B (separate subdomain, per the user's explicit choice over the PRD's default same-
 * origin topology A) needs real CORS — the browser sends preflighted cross-origin requests from
 * `app`'s origin to this server's origin. Wired now, inert until P1 adds routes a browser actually
 * calls; `credentials: true` is required so the (eventually shared, parent-domain-scoped) session
 * cookie is sent/received on cross-origin requests at all.
 */
const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

export const corsMiddleware = cors({
  origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? ""),
  credentials: true,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
});
