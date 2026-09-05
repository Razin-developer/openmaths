import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools-data";

const SITE_URL = "https://openmaths.com";

/**
 * Lists only the routes that actually exist. Next regenerates this file's output on every
 * request to `/sitemap.xml` (it's a route handler, not a static list baked at build time), so
 * each page added in a later checkpoint just needs a new entry here — no separate
 * sitemap-maintenance step. Tool pages are derived from the same `TOOLS` registry the hub and
 * `[slug]` route already use, so a new tool is automatically in the sitemap too.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/product`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/tools`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    ...TOOLS.map((tool) => ({
      url: `${SITE_URL}/tools/${tool.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
