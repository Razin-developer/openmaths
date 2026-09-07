import type { Metadata } from "next";
import { PenTool, Volume2, GitBranch } from "lucide-react";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { CTABand } from "@/components/CTABand";
import { FeatureRow } from "@/components/FeatureRow";

const VALUES = [
  { icon: <PenTool className="size-6 text-accent-blue-500" />, title: "Draw it, don't describe it", description: "A diagram builds live, step by step — never a shape summarized in a sentence." },
  { icon: <Volume2 className="size-6 text-accent-violet-500" />, title: "Narrate the reasoning", description: "Every step is read aloud in sync with the drawing, not left for you to infer." },
  { icon: <GitBranch className="size-6 text-accent-emerald-500" />, title: "A canvas, not a chat log", description: "Branch, annotate, and come back later — nothing you asked scrolls away." },
];

export const metadata: Metadata = {
  title: "About",
  description: "Why openmaths exists, and what it's actually trying to do differently.",
  alternates: { canonical: "https://openmaths.com/about" },
};

export default function AboutPage() {
  return (
    <>
      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">Teaching the why, not just the answer</h1>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <div className="prose prose-lg mx-auto max-w-[68ch] dark:prose-invert">
            <p>
              Most tools that answer math questions optimize for getting to a number fast. openmaths
              starts from a different premise: the number was rarely the hard part. The hard part is
              seeing which property of a shape or equation actually matters — and that&rsquo;s the part a
              plain answer engine skips right past.
            </p>
            <p>
              So the product is built around three things a fast-answer tool doesn&rsquo;t do: it draws the
              diagram live, step by step, instead of describing a shape in prose; it narrates the
              reasoning aloud, in sync with the drawing; and it puts every question on an actual canvas
              you can branch and annotate, instead of a chat log that scrolls away.
            </p>
            <p>
              This is a small, independently-built project — not a large team with a press office. If
              you want to reach the person behind it, the <a href="/contact">contact page</a> goes
              straight there.
            </p>
          </div>
        </Reveal>
      </Section>

      <Section width="wide" surface="shell">
        <Reveal className="mb-10 text-center">
          <h2 className="text-h3 font-semibold">Three things a fast-answer tool doesn&rsquo;t do</h2>
        </Reveal>
        <Reveal index={1}>
          <FeatureRow features={VALUES} />
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <CTABand title="See the difference for yourself." />
        </Reveal>
      </Section>
    </>
  );
}
