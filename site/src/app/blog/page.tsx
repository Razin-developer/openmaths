import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { getAllPosts } from "@/lib/content";

export const metadata: Metadata = {
  title: "Blog",
  description: "Math explainers and product notes from openmaths.",
};

export default async function BlogPage() {
  const posts = await getAllPosts();
  const categories = Array.from(new Set(posts.map((p) => p.category)));

  return (
    <>
      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">Blog</h1>
        </Reveal>
        <Reveal index={1} className="mt-4 flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <Link
              key={category}
              href={`/blog/category/${category.toLowerCase()}`}
              className="rounded-pill border border-border px-4 py-1.5 text-body-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              {category}
            </Link>
          ))}
        </Reveal>
      </Section>

      <Section width="wide">
        <ul className="mx-auto flex max-w-[70ch] flex-col divide-y divide-border">
          {posts.map((post, i) => (
            <Reveal key={post.slug} index={i} as="li" className="flex flex-col gap-2 py-8">
              <Link href={`/blog/${post.slug}`} className="flex flex-col gap-2">
                <span className="text-caption font-mono text-muted-foreground">
                  {post.category} · {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
                <h2 className="text-h3 font-semibold">{post.title}</h2>
                <p className="text-body text-muted-foreground">{post.excerpt}</p>
              </Link>
            </Reveal>
          ))}
        </ul>
      </Section>
    </>
  );
}
