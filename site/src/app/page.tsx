import { Shapes, PenTool, BarChart3, Table2, Volume2, GitBranch, LayoutGrid, Share2, Download, Smartphone } from "lucide-react";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/Button";
import { SignatureHero } from "@/components/SignatureHero";
import { StatCounter } from "@/components/StatCounter";
import { BentoGrid, BentoCard } from "@/components/BentoGrid";
import { PinnedSteps } from "@/components/PinnedSteps";
import { TriangleSolverDemo } from "@/components/TriangleSolverDemo";
import { Tabs } from "@/components/Tabs";
import { TestimonialCard } from "@/components/TestimonialCard";
import { CTABand } from "@/components/CTABand";
import { TESTIMONIALS, USE_CASES } from "@/lib/placeholder-content";
import { TOOLS } from "@/lib/tools-data";

const FORMS = [
  { icon: <Shapes className="size-6 text-accent" />, title: "Geometry", description: "Draws the diagram, then explains it step by step." },
  { icon: <PenTool className="size-6 text-accent" />, title: "Algebra", description: "Structured, numbered solution steps — not a wall of text." },
  { icon: <BarChart3 className="size-6 text-accent" />, title: "Graphs & Plots", description: "Plots the function and walks through key features." },
  { icon: <Table2 className="size-6 text-accent" />, title: "Tables", description: "Comparison and data-organization answers, laid out clearly." },
];

const FEATURES = [
  { icon: <Volume2 className="size-6 text-accent" />, title: "Voice narration", description: "Every step, read aloud in sync with the diagram." },
  { icon: <GitBranch className="size-6 text-accent" />, title: "Non-linear canvas", description: "Branch a sub-question off any answer, without losing your place." },
  { icon: <LayoutGrid className="size-6 text-accent" />, title: "Multi-form answers", description: "Steps, tables, and diagrams together when a question needs more than one." },
  { icon: <Share2 className="size-6 text-accent" />, title: "Sharing & roles", description: "Invite collaborators with editor or viewer access." },
  { icon: <Download className="size-6 text-accent" />, title: "Export video", description: "Turn a walkthrough into a narrated video export." },
  { icon: <Smartphone className="size-6 text-accent" />, title: "Works on mobile", description: "The same canvas, touch-friendly." },
];

const STEPS = [
  { title: "Ask", description: "Type any math question — arithmetic, algebra, geometry, calculus." },
  { title: "Watch it draw & narrate", description: "A diagram builds itself step by step, narrated aloud as it goes." },
  { title: "Explore on the canvas", description: "Branch follow-up questions, annotate, and come back to it any time." },
];

export default function HomePage() {
  return (
    <>
      <Section className="relative overflow-hidden">
        <div className="bg-graph-paper pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex flex-col items-center gap-10 text-center">
          <div className="flex flex-col items-center gap-6">
            <Reveal>
              <h1 className="text-display-xl md:text-display-2xl font-semibold tracking-tight text-balance">
                Watch math explain itself
              </h1>
            </Reveal>
            <Reveal index={1}>
              <p className="text-body-lg max-w-[60ch] text-muted-foreground">
                An AI math tutor that draws the diagram, narrates every step, and lets you branch and
                explore on an infinite canvas.
              </p>
            </Reveal>
            <Reveal index={2} className="flex gap-3">
              <Button href="http://localhost:3000" variant="primary">
                Start free
              </Button>
              <Button href="/product" variant="secondary">
                See it work
              </Button>
            </Reveal>
          </div>
          <Reveal index={3}>
            <SignatureHero />
          </Reveal>
        </div>
      </Section>

      <Section width="wide">
        <Reveal className="flex flex-wrap justify-center gap-12">
          <StatCounter value={50000} suffix="+" label="Problems explained" />
          <StatCounter value={98} suffix="%" label="Say it helped them understand, not just answer" />
          <StatCounter value={4} suffix=" answer forms" label="Steps, diagrams, tables, plots" />
        </Reveal>
      </Section>

      <Section>
        <div className="mx-auto flex max-w-[70ch] flex-col gap-10 text-center">
          <Reveal>
            <h2 className="text-h2 font-semibold text-balance">A calculator gives you an answer. openmaths teaches it.</h2>
          </Reveal>
          <Reveal index={1}>
            <p className="text-body-lg text-muted-foreground">
              Ask for the area of a triangle formed by a centroid, and a plain answer engine hands you
              a number. openmaths draws the triangle, marks the centroid, derives the area ratio step
              by step, and narrates why each step follows from the last.
            </p>
          </Reveal>
        </div>
      </Section>

      <Section width="wide">
        <Reveal className="mb-10 text-center">
          <h2 className="text-h2 font-semibold">One question, whichever form fits the answer</h2>
        </Reveal>
        <BentoGrid>
          {FORMS.map((form, i) => (
            <Reveal key={form.title} index={i}>
              <BentoCard {...form} />
            </Reveal>
          ))}
        </BentoGrid>
      </Section>

      <Section width="full" className="bg-muted/20">
        <div className="mx-auto max-w-[1200px] px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-h2 font-semibold">How it works</h2>
          </Reveal>
        </div>
        <PinnedSteps steps={STEPS} />
      </Section>

      <Section>
        <Reveal className="mb-10 text-center">
          <h2 className="text-h2 font-semibold">Try the right-triangle solver — no sign-up</h2>
        </Reveal>
        <Reveal index={1}>
          <TriangleSolverDemo />
        </Reveal>
      </Section>

      <Section width="wide">
        <Reveal className="mb-10 text-center">
          <h2 className="text-h2 font-semibold">Everything you&rsquo;d expect from a real tutor</h2>
        </Reveal>
        <BentoGrid className="lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} index={i}>
              <BentoCard {...feature} />
            </Reveal>
          ))}
        </BentoGrid>
      </Section>

      <Section>
        <Reveal className="mb-10 text-center">
          <h2 className="text-h2 font-semibold">Built for the way you actually study</h2>
        </Reveal>
        <Reveal index={1}>
          <Tabs
            tabs={USE_CASES.map((useCase) => ({
              label: useCase.label,
              content: (
                <div className="mx-auto flex max-w-[60ch] flex-col gap-3 text-center">
                  <h3 className="text-h3 font-semibold">{useCase.headline}</h3>
                  <p className="text-body text-muted-foreground">{useCase.body}</p>
                </div>
              ),
            }))}
          />
        </Reveal>
      </Section>

      <Section width="wide">
        <Reveal className="mb-10 text-center">
          <h2 className="text-h2 font-semibold">What learners say</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial, i) => (
            <Reveal key={testimonial.name} index={i}>
              <TestimonialCard {...testimonial} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section width="wide">
        <Reveal className="mb-10 text-center">
          <h2 className="text-h2 font-semibold">Free math tools, no login</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.slice(0, 3).map((tool, i) => (
            <Reveal key={tool.slug} index={i}>
              <a href={`/tools/${tool.slug}`} className="flex h-full flex-col gap-2 rounded-xl border border-border bg-muted/40 p-6 transition-colors hover:bg-muted">
                <h3 className="text-h4 font-semibold">{tool.name}</h3>
                <p className="text-body-sm text-muted-foreground">{tool.shortDescription}</p>
              </a>
            </Reveal>
          ))}
        </div>
        <Reveal index={3} className="mt-8 flex justify-center">
          <Button href="/tools" variant="secondary">
            See all tools
          </Button>
        </Reveal>
      </Section>

      <Section>
        <Reveal className="mb-6 text-center">
          <h2 className="text-h2 font-semibold">Free to start</h2>
        </Reveal>
        <Reveal index={1} className="text-center">
          <p className="mx-auto max-w-[50ch] text-body text-muted-foreground">
            Unlimited canvases and every answer form on the Free plan.{" "}
            <a href="/pricing" className="text-accent underline underline-offset-4">
              See full pricing →
            </a>
          </p>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <CTABand title="Start explaining math, not just answering it." />
        </Reveal>
      </Section>
    </>
  );
}
