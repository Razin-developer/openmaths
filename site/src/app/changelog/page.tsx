import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { ProseArticle } from "@/components/ProseArticle";
import { getAllChangelogEntries } from "@/lib/content";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What's new in openmaths.",
  alternates: { canonical: "https://openmaths.com/changelog" },
};

export default async function ChangelogPage() {
  const entries = await getAllChangelogEntries();

  return (
    <>
      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">Changelog</h1>
        </Reveal>
      </Section>

      <Section>
        <div className="mx-auto flex max-w-[68ch] flex-col gap-12">
          {entries.map((entry, i) => (
            <Reveal key={entry.slug} index={i} className="flex flex-col gap-4 border-b border-border pb-12 last:border-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-caption font-mono text-muted-foreground">
                  {new Date(entry.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
                {entry.tags.map((tag) => (
                  <span key={tag} className="rounded-pill bg-accent-blue-500/15 px-2.5 py-0.5 text-caption font-medium text-accent-blue-600">
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="text-h3 font-semibold">{entry.title}</h2>
              <ProseArticle>
                <entry.Content />
              </ProseArticle>
            </Reveal>
          ))}
        </div>
      </Section>
    </>
  );
}
