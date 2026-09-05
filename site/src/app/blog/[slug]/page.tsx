import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { ProseArticle } from "@/components/ProseArticle";
import { CTABand } from "@/components/CTABand";
import { blogSlugs, getAllPosts } from "@/lib/content";

export function generateStaticParams() {
  return blogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const posts = await getAllPosts();
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};
  return { title: post.title, description: post.description };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const posts = await getAllPosts();
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  // Dynamic MDX import, per next.js's own documented pattern for this exact case (App Router MDX
  // guide, "Using dynamic imports") — `slug` is already validated against `blogSlugs()` above via
  // `generateStaticParams`/the `find()` above, so this can't be used to import an arbitrary path.
  const { default: Content } = await import(`@/content/blog/${slug}.mdx`);

  return (
    <>
      <Section className="text-center">
        <Reveal>
          <span className="text-caption font-mono text-muted-foreground">
            {post.category} · {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </span>
        </Reveal>
        <Reveal index={1}>
          <h1 className="mt-2 text-display-xl font-semibold text-balance">{post.title}</h1>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <ProseArticle>
            <Content />
          </ProseArticle>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <CTABand title="See the same kind of explanation, for your own question." />
        </Reveal>
      </Section>
    </>
  );
}
