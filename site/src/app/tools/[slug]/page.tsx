import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { CTABand } from "@/components/CTABand";
import { TOOLS, getTool } from "@/lib/tools-data";

const SITE_URL = "https://openmaths.com";

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: tool.name,
    description: tool.shortDescription,
    alternates: { canonical: `${SITE_URL}/tools/${tool.slug}` },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const ToolComponent = tool.component;

  // SoftwareApplication + HowTo JSON-LD (PRD §6/§8) — each tool is a real, useable calculator,
  // so both schemas describe something genuinely true, not aspirational boilerplate.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: tool.name,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any (web-based)",
        description: tool.shortDescription,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        url: `${SITE_URL}/tools/${tool.slug}`,
      },
      {
        "@type": "HowTo",
        name: tool.name,
        step: tool.howTo.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
      },
    ],
  };

  return (
    <>
      {/* Static JSON-LD built from this file's own typed tool metadata, not user input — nothing
          here to sanitize against. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">{tool.name}</h1>
        </Reveal>
        <Reveal index={1}>
          <p className="mx-auto mt-4 max-w-[50ch] text-body-lg text-muted-foreground">{tool.shortDescription}</p>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <ToolComponent />
        </Reveal>
      </Section>

      <Section>
        <Reveal className="mx-auto flex max-w-[60ch] flex-col gap-4">
          <h2 className="text-h3 font-semibold">How to use this tool</h2>
          <ol className="flex flex-col gap-2 text-body text-muted-foreground">
            {tool.howTo.map((step, i) => (
              <li key={i}>
                {i + 1}. {step}
              </li>
            ))}
          </ol>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <CTABand title="Want the full worked explanation, with a diagram and narrated steps?" />
        </Reveal>
      </Section>
    </>
  );
}
