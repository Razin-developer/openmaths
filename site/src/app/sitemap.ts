import type { MetadataRoute } from "next";

const SITE_URL = "https://openmaths.com";

/**
 * P1 lists only the routes that actually exist. Next regenerates this file's output on every
 * request to `/sitemap.xml` (it's a route handler, not a static list baked at build time), so
 * each page added in P2+ just needs a new entry here — no separate sitemap-maintenance step.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/product`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  ];
}
