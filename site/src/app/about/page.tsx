import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { CTABand } from "@/components/CTABand";

export const metadata: Metadata = {
  title: "About",
  description: "Why openmaths exists, and what it's actually trying to do differently.",
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

      <Section>
        <Reveal>
          <CTABand title="See the difference for yourself." />
        </Reveal>
      </Section>
    </>
  );
}
