import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { FAQAccordion } from "@/components/FAQAccordion";
import { FAQ_ITEMS } from "@/lib/faq-data";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about openmaths.",
};

export default function FAQPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">Frequently asked questions</h1>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <div className="mx-auto max-w-[68ch]">
            <FAQAccordion items={FAQ_ITEMS} />
          </div>
        </Reveal>
      </Section>
    </>
  );
}
