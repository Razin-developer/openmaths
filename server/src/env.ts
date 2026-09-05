import { z } from "zod";

/**
 * Fail-fast env validation (PRD "Split into app + server" §5.1 — "Env: zod-validated env at boot,
 * fail fast if a secret is missing"). This is P0's skeleton: only the vars the health-check route
 * needs today. `HACKCLUB_AI_API_KEY` and auth secrets are required now (not yet consumed by any
 * route) so the shape is locked in before P1 starts actually using them — a missing secret should
 * fail server boot immediately, not surface as a mysterious 500 on the first real request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  HACKCLUB_AI_API_KEY: z.string().min(1, "HACKCLUB_AI_API_KEY is required"),
  // Comma-separated allowlist of origins allowed to call this server (topology B — separate
  // subdomain — needs real CORS, unlike same-origin topology A's zero-CORS rewrite approach).
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  // The parent registrable domain the session cookie will eventually be scoped to once auth
  // issuance moves here (P2) — e.g. ".openmaths.com". Left empty for local dev, where a
  // host-only cookie (no Domain attribute) is correct on plain localhost.
  COOKIE_DOMAIN: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console -- boot-time fatal, before any logger exists
    console.error("[server] Invalid environment configuration:\n" + parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"));
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
