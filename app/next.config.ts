import path from "node:path";
import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// Dev-tooling addition (PRD "Performance Audit & Answer-Rendering Fix" — bundle-analyzer): opt-in
// via `ANALYZE=true pnpm run analyze` (see package.json), off by default so it never affects a
// normal `next build`/`next dev` run or ships anything extra to production.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

/**
 * Security headers (PRD "Auth & Security Audit" F5). `next.config.ts` was previously empty — no
 * HSTS, clickjacking, MIME-sniffing, referrer, or CSP protection at all.
 *
 * The Content-Security-Policy itself is set (enforced, nonce-based) in `src/proxy.ts`'s
 * middleware instead of here — a static per-route header can't carry a fresh per-request nonce,
 * which `script-src` needs to drop `'unsafe-inline'` safely. Everything below is static and
 * carries no risk of breaking legitimate functionality, so it stays here.
 */
const nextConfig: NextConfig = {
  // Docker (PRD "production hardening" P5) — a minimal, self-contained runtime image copying
  // only the traced dependency graph. `outputFileTracingRoot` is pinned to the monorepo root
  // (not just `app/`, the default) since this app resolves `@openmaths/*` workspace packages
  // that live outside `app/` via pnpm symlinks — leaving it unset would silently drop them from
  // the trace and produce a `standalone` build that 500s on missing modules.
  outputFileTracingRoot: path.join(__dirname, ".."),
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // No `<iframe>` embedding of the app anywhere — the canvas is the whole product surface
          // and has no legitimate reason to be framed (clickjacking defense, PRD F5).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
