import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { getAllResources } from "@/lib/content";

export const metadata: Metadata = {
  title: "Resources",
  description: "Guides and cheatsheets for common math topics.",
};

export default async function ResourcesPage() {
  const resources = await getAllResources();
  const categories = Array.from(new Set(resources.map((r) => r.category)));

  return (
    <>
      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">Resources</h1>
        </Reveal>
        <Reveal index={1}>
          <p className="mx-auto mt-4 max-w-[50ch] text-body-lg text-muted-foreground">
            Guides and cheatsheets for the topics that come up again and again.
          </p>
        </Reveal>
      </Section>

      {categories.map((category, categoryIndex) => (
        <Section key={category} width="wide">
          <Reveal index={categoryIndex} className="mb-8">
            <h2 className="text-h3 font-semibold">{category}</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources
              .filter((r) => r.category === category)
              .map((resource, i) => (
                <Reveal key={resource.slug} index={i}>
                  <Link
                    href={`/resources/${resource.slug}`}
                    className="flex h-full flex-col gap-2 rounded-xl border border-border bg-muted/40 p-6 transition-colors hover:bg-muted"
                  >
                    <h3 className="text-h4 font-semibold">{resource.title}</h3>
                    <p className="text-body-sm text-muted-foreground">{resource.excerpt}</p>
                  </Link>
                </Reveal>
              ))}
          </div>
        </Section>
      ))}
    </>
  );
}
