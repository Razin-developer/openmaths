import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { getAllPosts } from "@/lib/content";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  const categories = Array.from(new Set(posts.map((p) => p.category.toLowerCase())));
  return categories.map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  return { title: `Blog: ${category}`, alternates: { canonical: `https://openmaths.com/blog/category/${category}` } };
}

export default async function BlogCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const posts = await getAllPosts();
  const matching = posts.filter((p) => p.category.toLowerCase() === category);
  if (matching.length === 0) notFound();

  return (
    <>
      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold capitalize text-balance">{category}</h1>
        </Reveal>
        <Reveal index={1}>
          <Link href="/blog" className="mt-4 inline-block text-body-sm text-accent underline underline-offset-4">
            ← All posts
          </Link>
        </Reveal>
      </Section>

      <Section width="wide">
        <ul className="mx-auto flex max-w-[70ch] flex-col divide-y divide-border">
          {matching.map((post, i) => (
            <Reveal key={post.slug} index={i} as="li" className="flex flex-col gap-2 py-8">
              <Link href={`/blog/${post.slug}`} className="flex flex-col gap-2">
                <span className="text-caption font-mono text-muted-foreground">
                  {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
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
