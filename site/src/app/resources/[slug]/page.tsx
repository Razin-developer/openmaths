import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { ProseArticle } from "@/components/ProseArticle";
import { CTABand } from "@/components/CTABand";
import { resourceSlugs, getAllResources } from "@/lib/content";

export function generateStaticParams() {
  return resourceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const resources = await getAllResources();
  const resource = resources.find((r) => r.slug === slug);
  if (!resource) return {};
  return { title: resource.title, description: resource.description };
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resources = await getAllResources();
  const resource = resources.find((r) => r.slug === slug);
  if (!resource) notFound();

  const { default: Content } = await import(`@/content/resources/${slug}.mdx`);

  return (
    <>
      <Section className="text-center">
        <Reveal>
          <span className="text-caption font-mono text-muted-foreground">{resource.category}</span>
        </Reveal>
        <Reveal index={1}>
          <h1 className="mt-2 text-display-xl font-semibold text-balance">{resource.title}</h1>
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
          <CTABand title="Get the full step-by-step explanation for your own problem." />
        </Reveal>
      </Section>
    </>
  );
}
