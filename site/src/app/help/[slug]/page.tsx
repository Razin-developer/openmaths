import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { ProseArticle } from "@/components/ProseArticle";
import { helpSlugs, getAllHelpArticles } from "@/lib/content";

export function generateStaticParams() {
  return helpSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const articles = await getAllHelpArticles();
  const article = articles.find((a) => a.slug === slug);
  if (!article) return {};
  return { title: article.title, description: article.description };
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const articles = await getAllHelpArticles();
  const article = articles.find((a) => a.slug === slug);
  if (!article) notFound();

  const { default: Content } = await import(`@/content/help/${slug}.mdx`);

  return (
    <>
      <Section className="text-center">
        <Reveal>
          <Link href="/help" className="text-body-sm text-accent underline underline-offset-4">
            ← Help Center
          </Link>
        </Reveal>
        <Reveal index={1}>
          <h1 className="mt-4 text-display-xl font-semibold text-balance">{article.title}</h1>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <ProseArticle>
            <Content />
          </ProseArticle>
        </Reveal>
      </Section>
    </>
  );
}
