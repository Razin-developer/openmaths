import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools-data";
import { getAllPosts, getAllResources, getAllHelpArticles } from "@/lib/content";

const SITE_URL = "https://openmaths.com";

/**
 * Lists only the routes that actually exist. Next regenerates this file's output on every
 * request to `/sitemap.xml` (it's a route handler, not a static list baked at build time), so
 * each page added in a later checkpoint just needs a new entry here — no separate
 * sitemap-maintenance step. Tool/blog/resource/help entries are all derived from the same
 * registries their own hub and `[slug]` routes use, so a new one is automatically in the sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, resources, helpArticles] = await Promise.all([getAllPosts(), getAllResources(), getAllHelpArticles()]);
  const categories = Array.from(new Set(posts.map((p) => p.category.toLowerCase())));

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/product`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/tools`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/resources`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/help`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/changelog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    ...TOOLS.map((tool) => ({ url: `${SITE_URL}/tools/${tool.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...posts.map((post) => ({ url: `${SITE_URL}/blog/${post.slug}`, lastModified: new Date(post.date), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...categories.map((category) => ({ url: `${SITE_URL}/blog/category/${category}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.5 })),
    ...resources.map((resource) => ({ url: `${SITE_URL}/resources/${resource.slug}`, lastModified: new Date(resource.date), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...helpArticles.map((article) => ({ url: `${SITE_URL}/help/${article.slug}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
