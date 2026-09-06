import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { CASE_STUDIES, getCaseStudy } from "@/lib/case-studies";

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) return {};
  return { title: study.company, description: study.summary, alternates: { canonical: `https://openmaths.com/customers/${slug}` } };
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) notFound();

  return (
    <Section className="text-center">
      <Reveal>
        <span className="text-caption font-mono text-muted-foreground">{study.company}</span>
      </Reveal>
      <Reveal index={1}>
        <h1 className="mt-2 text-display-xl font-semibold text-balance">{study.headline}</h1>
      </Reveal>
      <Reveal index={2} className="mx-auto mt-10 flex max-w-[60ch] flex-col gap-4 text-left text-body text-muted-foreground">
        {study.body.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </Reveal>
    </Section>
  );
}
