import fs from "node:fs";
import path from "node:path";

const CONTENT_ROOT = path.join(process.cwd(), "src", "content");

export interface PostMeta {
  title: string;
  description: string;
  date: string;
  category: string;
  excerpt: string;
}

export interface HelpMeta {
  title: string;
  description: string;
  category: string;
}

export interface ChangelogMeta {
  title: string;
  date: string;
  tags: string[];
}

/**
 * Server-only (uses `fs`) — matches next.js's own MDX guide, which names this exact `fs`-based
 * approach for building an index page from a directory of MDX files ("Frontmatter" section).
 * Each `.mdx` file exports `metadata` — `@next/mdx` doesn't support YAML frontmatter natively, so
 * this is the documented alternative, not a workaround.
 */
function listSlugs(collection: string): string[] {
  const dir = path.join(CONTENT_ROOT, collection);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export async function getAllPosts(): Promise<Array<PostMeta & { slug: string }>> {
  const slugs = listSlugs("blog");
  const posts = await Promise.all(
    slugs.map(async (slug) => {
      const { metadata } = (await import(`@/content/blog/${slug}.mdx`)) as { metadata: PostMeta };
      return { ...metadata, slug };
    })
  );
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getAllResources(): Promise<Array<PostMeta & { slug: string }>> {
  const slugs = listSlugs("resources");
  const resources = await Promise.all(
    slugs.map(async (slug) => {
      const { metadata } = (await import(`@/content/resources/${slug}.mdx`)) as { metadata: PostMeta };
      return { ...metadata, slug };
    })
  );
  return resources.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getAllHelpArticles(): Promise<Array<HelpMeta & { slug: string }>> {
  const slugs = listSlugs("help");
  const articles = await Promise.all(
    slugs.map(async (slug) => {
      const { metadata } = (await import(`@/content/help/${slug}.mdx`)) as { metadata: HelpMeta };
      return { ...metadata, slug };
    })
  );
  return articles;
}

export async function getAllChangelogEntries(): Promise<Array<ChangelogMeta & { slug: string; Content: React.ComponentType }>> {
  const slugs = listSlugs("changelog");
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const mod = (await import(`@/content/changelog/${slug}.mdx`)) as { metadata: ChangelogMeta; default: React.ComponentType };
      return { ...mod.metadata, slug, Content: mod.default };
    })
  );
  return entries.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function blogSlugs(): string[] {
  return listSlugs("blog");
}

export function resourceSlugs(): string[] {
  return listSlugs("resources");
}

export function helpSlugs(): string[] {
  return listSlugs("help");
}
