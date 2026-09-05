import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { TestimonialCard } from "@/components/TestimonialCard";
import { Button } from "@/components/Button";
import { TESTIMONIALS } from "@/lib/placeholder-content";
import { CASE_STUDIES } from "@/lib/case-studies";

export const metadata: Metadata = {
  title: "Reviews",
  description: "What learners say about openmaths.",
};

export default function ReviewsPage() {
  return (
    <>
      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">What learners say</h1>
        </Reveal>
        <Reveal index={1} className="mt-4 flex justify-center gap-0.5 text-warning" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-6" fill="currentColor" strokeWidth={0} />
          ))}
        </Reveal>
      </Section>

      <Section width="wide">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial, i) => (
            <Reveal key={testimonial.name} index={i}>
              <TestimonialCard {...testimonial} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <Reveal className="mb-8 text-center">
          <h2 className="text-h2 font-semibold">Case studies</h2>
        </Reveal>
        <div className="mx-auto flex max-w-[60ch] flex-col gap-4">
          {CASE_STUDIES.map((study, i) => (
            <Reveal key={study.slug} index={i}>
              <Link href={`/customers/${study.slug}`} className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-6 transition-colors hover:bg-muted">
                <span className="text-caption font-mono text-muted-foreground">{study.company}</span>
                <h3 className="text-h4 font-semibold">{study.headline}</h3>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="text-center">
        <Reveal>
          <Button href="/feedback" variant="secondary">
            Leave a review
          </Button>
        </Reveal>
      </Section>
    </>
  );
}
