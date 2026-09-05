import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { HelpSearch } from "@/components/HelpSearch";
import { getAllHelpArticles } from "@/lib/content";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Search openmaths help articles, or browse by category.",
};

/**
 * Flat, not the PRD's nested `/help/[category]/[article]` (§5.1) — a real scope reduction for
 * this checkpoint given the current article count (a handful, not dozens), documented here
 * rather than silently built differently from what §5.1 names. Category nesting is trivial to
 * add later once there's enough content per category to actually need a dedicated listing page.
 */
export default async function HelpPage() {
  const articles = await getAllHelpArticles();

  return (
    <>
      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">Help Center</h1>
        </Reveal>
      </Section>

      <Section width="wide">
        <Reveal>
          <HelpSearch articles={articles} />
        </Reveal>
      </Section>
    </>
  );
}
