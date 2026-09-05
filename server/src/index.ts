import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { setRateLimitStore, PostgresRateLimitStore } from "@openmaths/db/auth/rateLimit";
import { env } from "./env";
import { corsMiddleware } from "./middleware/cors";
import { csrfMiddleware } from "./middleware/csrf";
import { healthRoutes } from "./routes/health";
import { modelsRoutes } from "./routes/models";
import { notificationRoutes } from "./routes/notifications";
import { canvasRoutes } from "./routes/canvases";
import { authRoutes } from "./routes/auth";
import { skillsRoutes } from "./routes/skills";
import { connectionRoutes } from "./routes/connections";
import { sharingRoutes } from "./routes/sharing";
import { blockRoutes } from "./routes/blocks";
import { usageRoutes } from "./routes/usage";
import { userRoutes } from "./routes/user";
import { narrateRoutes } from "./routes/narrate";
import { messageRoutes } from "./routes/messages";
import { blockGenerationRoutes } from "./routes/blockGeneration";
import { linkPreviewRoutes } from "./routes/linkPreview";
import { contactRoutes } from "./routes/contact";

/**
 * PRD "Split into app + server" — P1 stood up the first real, DB-backed, auth-verified read-only
 * routes (models, notifications GET, canvases GET), additive alongside `app`'s untouched copies.
 * P2 makes this server the actual session ISSUER: `/auth/login` and `/auth/logout` mint/clear the
 * same NextAuth-compatible session cookie `app`'s own `auth.ts` already knows how to read (see
 * lib/auth/session.ts's doc comment for the compatibility contract) — `app`'s login/logout UI now
 * calls here instead of NextAuth's own credentials flow, but `auth.ts` itself is unmodified.
 */
// PRD "Split into app + server" P5 — swaps the in-process Map default (documented, since P2, as
// the reason `server` and `app` don't share rate-limit buckets across the split) for the
// already-implemented Postgres-backed store, closing that gap for real: every `checkRateLimit`
// call in this process now goes through the same `RateLimitBucket` table `app`'s own Middleware
// instance also targets (see `app/src/instrumentation.ts`), so a login spray or a generation-spam
// script hitting both origins shares one set of counters instead of getting double the budget for
// free by alternating between them.
setRateLimitStore(new PostgresRateLimitStore());

const app = new Hono();

app.use("*", requestId());
app.use("*", logger());
app.use("*", corsMiddleware);
app.use("*", csrfMiddleware);

app.route("/", healthRoutes);
app.route("/", modelsRoutes);
app.route("/", notificationRoutes);
app.route("/", canvasRoutes);
app.route("/", authRoutes);
app.route("/", skillsRoutes);
app.route("/", connectionRoutes);
app.route("/", sharingRoutes);
app.route("/", blockRoutes);
app.route("/", usageRoutes);
app.route("/", userRoutes);
app.route("/", narrateRoutes);
app.route("/", messageRoutes);
app.route("/", blockGenerationRoutes);
app.route("/", linkPreviewRoutes);
app.route("/", contactRoutes);

const port = env.PORT;
serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console -- boot confirmation, no logger infra yet
  console.log(`[server] listening on http://localhost:${info.port} (${env.NODE_ENV})`);
});
