import path from "node:path";
import type { NextConfig } from "next";

/**
 * Marketing site (PRD "Public Product Site, Pages & Design/Motion System" P1) — a separate
 * Next.js app from `app/`, deliberately: SSG/ISR-first, no auth/WebGL/Prisma weight (§1 of the
 * PRD). `output: "standalone"` + the pinned tracing root mirror `app/next.config.ts`'s own Docker
 * setup, for when this ships the same way.
 */
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, ".."),
  output: "standalone",
};

export default nextConfig;
