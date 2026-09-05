import { Hono } from "hono";
import { prisma } from "@openmaths/db";

export const healthRoutes = new Hono();

// Liveness — process is up and answering HTTP, nothing more.
healthRoutes.get("/healthz", (c) => c.json({ status: "ok" }));

// Readiness — also proves the DB is actually reachable through @openmaths/db, the real point of
// this checkpoint: confirming the extracted package resolves and works standalone from `server`.
healthRoutes.get("/readyz", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: "ok", db: "up" });
  } catch (err) {
    // eslint-disable-next-line no-console -- readiness-check failure, worth a server log
    console.error("[readyz] DB check failed:", err);
    return c.json({ status: "error", db: "down" }, 503);
  }
});
