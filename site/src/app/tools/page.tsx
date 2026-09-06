import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { TOOLS } from "@/lib/tools-data";

export const metadata: Metadata = {
  title: "Free Math Tools",
  description: "Free, no-login math calculators — right triangles, quadratics, percentages, fractions, unit conversion, slope, and statistics.",
};

const CATEGORIES = Array.from(new Set(TOOLS.map((t) => t.category)));

export default function ToolsPage() {
  return (
    <>
      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">Free math tools</h1>
        </Reveal>
        <Reveal index={1}>
          <p className="mx-auto mt-4 max-w-[50ch] text-body-lg text-muted-foreground">
            No sign-up, no ads. Each one uses the same math openmaths does — just without the
            step-by-step explanation.
          </p>
        </Reveal>
      </Section>

      {CATEGORIES.map((category, categoryIndex) => (
        <Section key={category} width="wide">
          <Reveal index={categoryIndex} className="mb-8">
            <h2 className="text-h3 font-semibold">{category}</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.filter((t) => t.category === category).map((tool, i) => (
              <Reveal key={tool.slug} index={i}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="flex h-full flex-col gap-2 rounded-xl border border-border-hairline bg-surface-card p-6 transition-colors hover:bg-surface-card-hover"
                >
                  <h3 className="text-h4 font-semibold">{tool.name}</h3>
                  <p className="text-body-sm text-muted-foreground">{tool.shortDescription}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
