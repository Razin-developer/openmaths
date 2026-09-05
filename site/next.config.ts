import path from "node:path";
import createMDX from "@next/mdx";
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
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

/**
 * P4 content pipeline (blog/resources/help/changelog, PRD §8) — plain `.mdx` files under
 * `src/content/*`, each with an `export const metadata = {...}` (the officially documented way
 * to attach frontmatter-like data without a separate parser: see next.js's own MDX guide,
 * "Frontmatter" section — `@next/mdx` doesn't support YAML frontmatter natively). Plugin names
 * are passed as strings, not function references, per that same guide's Turbopack section:
 * "remark and rehype plugins without serializable options cannot be used yet with Turbopack,
 * because JavaScript functions can't be passed to Rust" — this app's dev/build both run on
 * Turbopack (confirmed in every prior build's own console output).
 */
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm", "remark-math"],
    rehypePlugins: ["rehype-katex"],
  },
});

export default withMDX(nextConfig);
