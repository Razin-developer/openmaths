import { Shapes, PenTool, BarChart3, Table2, Volume2, GitBranch, LayoutGrid, Share2, Download, Smartphone, Layers, Sparkles, Infinity as InfinityIcon, Check } from "lucide-react";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/Button";
import { GlowBand } from "@/components/GlowBand";
import { FeatureRow } from "@/components/FeatureRow";
import { TrustPanel } from "@/components/TrustPanel";
import { CompareBento } from "@/components/CompareBento";
import { StatCounter } from "@/components/StatCounter";
import { BentoGrid, BentoCard } from "@/components/BentoGrid";
import { PinnedSteps } from "@/components/PinnedSteps";
import { TriangleSolverDemo } from "@/components/TriangleSolverDemo";
import { TESTIMONIALS } from "@/lib/placeholder-content";
import { TOOLS } from "@/lib/tools-data";
import { APP_URL } from "@/lib/urls";

const FORMS = [
  { icon: <Shapes className="size-6 text-accent-blue-500" />, title: "Geometry", description: "Draws the diagram, then explains it step by step.", span: "2" as const, featured: true },
  { icon: <PenTool className="size-6 text-accent-blue-500" />, title: "Algebra", description: "Structured, numbered solution steps — not a wall of text." },
  { icon: <BarChart3 className="size-6 text-accent-blue-500" />, title: "Graphs & Plots", description: "Plots the function and walks through key features." },
  { icon: <Table2 className="size-6 text-accent-blue-500" />, title: "Tables", description: "Comparison and data-organization answers, laid out clearly." },
];

const FEATURES = [
  { icon: <Volume2 className="size-6 text-accent-blue-500" />, title: "Voice narration", description: "Every step, read aloud in sync with the diagram.", span: "2" as const, featured: true },
  { icon: <GitBranch className="size-6 text-accent-blue-500" />, title: "Non-linear canvas", description: "Branch a sub-question off any answer, without losing your place." },
  { icon: <LayoutGrid className="size-6 text-accent-blue-500" />, title: "Multi-form answers", description: "Steps, tables, and diagrams together when a question needs more than one." },
  { icon: <Share2 className="size-6 text-accent-blue-500" />, title: "Sharing & roles", description: "Invite collaborators with editor or viewer access." },
  { icon: <Download className="size-6 text-accent-blue-500" />, title: "Export video", description: "Turn a walkthrough into a narrated video export." },
  { icon: <Smartphone className="size-6 text-accent-blue-500" />, title: "Works on mobile", description: "The same canvas, touch-friendly." },
];

const CANVAS_FEATURES = [
  { icon: <Layers className="size-6 text-accent-blue-500" />, title: "Draws every form", description: "Diagrams, steps, tables, and plots — the same canvas, whichever the question calls for." },
  { icon: <Sparkles className="size-6 text-accent-violet-500" />, title: "Narrates as it goes", description: "Each step is read aloud in sync with the diagram building, not dumped as a wall of text." },
  { icon: <InfinityIcon className="size-6 text-accent-emerald-500" />, title: "Branches without limit", description: "Spin off a sub-question from any answer and come back to the original without losing your place." },
];

const USE_CASE_CARDS = [
  {
    label: "Students",
    title: "Understand the why, not just the answer",
    description: "Every solution comes with a diagram that draws itself and a narrated walkthrough of each step — so you can follow the reasoning, not just copy the result.",
    span: "2" as const,
    featured: true,
  },
  {
    label: "Self-learners",
    title: "Study at your own pace",
    description: "Branch off any question, annotate the canvas, and come back to it later — your work is a canvas, not a disappearing chat log.",
  },
  {
    label: "Teachers",
    title: "A visual aid you didn't have to make",
    description: "Generate a worked example with a live diagram in seconds and project it for the class.",
  },
  {
    label: "Parents",
    title: "Help with homework you don't remember",
    description: "Ask the same question your kid is stuck on and get a real explanation, not just a number to hand over.",
  },
];

const TRUST_TABS = [
  { id: "students", label: "Students", testimonial: TESTIMONIALS[0] },
  { id: "self-learners", label: "Self-learners", testimonial: TESTIMONIALS[1] },
  { id: "teachers", label: "Teachers", testimonial: TESTIMONIALS[2] },
];

export default function HomePage() {
  return (
    <>
      <Section>
        <Reveal>
          <GlowBand>
            <span className="rounded-pill border border-white/25 bg-white/10 px-4 py-1.5 text-caption font-medium uppercase tracking-wide">
              Now free to start — every answer form included
            </span>
            <h1 className="text-display-xl md:text-display-2xl font-semibold tracking-tight text-balance">
              Watch math explain itself
            </h1>
            <p className="max-w-[52ch] text-body-lg text-white/85">
              An AI math tutor that draws the diagram, narrates every step, and lets you branch and
              explore on an infinite canvas.
            </p>
            <Button href={APP_URL} variant="secondary" className="!bg-white !text-accent-blue-600 hover:opacity-90" ctaId="hero-start-free">
              Start free
            </Button>
          </GlowBand>
        </Reveal>
      </Section>

      <Section width="wide" className="text-center">
        <Reveal>
          <h2 className="text-h2 font-semibold text-balance">One canvas, every branch of math</h2>
        </Reveal>
        <Reveal index={1}>
          <p className="mx-auto mt-3 max-w-[60ch] text-body text-muted-foreground">
            Not a chatbot that scrolls away — a canvas that draws, narrates, and remembers where every
            question led.
          </p>
        </Reveal>
        <Reveal index={2} className="mt-12">
          <FeatureRow features={CANVAS_FEATURES} />
        </Reveal>
      </Section>

      <Section surface="shell">
        <Reveal className="text-center">
          <h2 className="text-h2 font-semibold text-balance">What learners actually say</h2>
        </Reveal>
        <Reveal index={1} className="mx-auto mt-3 max-w-[60ch] text-center text-body text-muted-foreground">
          Illustrative for now — real collector coming as reviews come in.
        </Reveal>
        <Reveal index={2} className="mt-10">
          <TrustPanel tabs={TRUST_TABS} />
        </Reveal>
        <Reveal index={3} className="mt-16 flex flex-wrap justify-center gap-12">
          <StatCounter value={50000} suffix="+" label="Problems explained" />
          <StatCounter value={98} suffix="%" label="Say it helped them understand, not just answer" />
          <StatCounter value={4} suffix=" answer forms" label="Steps, diagrams, tables, plots" />
        </Reveal>
      </Section>

      <Section>
        <Reveal className="mb-10 text-center">
          <h2 className="text-h2 font-semibold text-balance">A calculator gives you an answer. openmaths teaches it.</h2>
        </Reveal>
        <Reveal index={1}>
          <CompareBento
            leftEyebrow="Plain calculator"
            leftTitle="A number, with no reasoning behind it"
            leftBody="Ask for the area of a triangle formed by a centroid, and a plain answer engine hands you a figure — nothing about how it got there."
            leftAnswer="A number."
            rightEyebrow="openmaths"
            rightTitle="The diagram, the steps, the why"
            rightBody="openmaths draws the triangle, marks the centroid, derives the area ratio step by step, and narrates why each step follows from the last."
            rightCta="See it work"
            rightHref="/product"
          />
        </Reveal>
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

      <Section width="full" surface="shell">
        <div className="mx-auto max-w-[1200px] px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-h2 font-semibold">How it works</h2>
          </Reveal>
        </div>
        <PinnedSteps
          steps={[
            { title: "Ask", description: "Type any math question — arithmetic, algebra, geometry, calculus." },
            { title: "Watch it draw & narrate", description: "A diagram builds itself step by step, narrated aloud as it goes." },
            { title: "Explore on the canvas", description: "Branch follow-up questions, annotate, and come back to it any time." },
          ]}
        />
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

      <Section surface="shell">
        <Reveal className="mb-10 text-center">
          <h2 className="text-h2 font-semibold">Built for the way you actually study</h2>
        </Reveal>
        <BentoGrid>
          {USE_CASE_CARDS.map((useCase, i) => (
            <Reveal key={useCase.label} index={i}>
              <BentoCard title={useCase.title} description={useCase.description} span={useCase.span} featured={useCase.featured} icon={<span className="text-caption font-mono-code uppercase tracking-wide text-muted-foreground">{useCase.label}</span>} />
            </Reveal>
          ))}
        </BentoGrid>
      </Section>

      <Section width="wide">
        <Reveal className="mb-10 text-center">
          <h2 className="text-h2 font-semibold">Free math tools, no login</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.slice(0, 3).map((tool, i) => (
            <Reveal key={tool.slug} index={i}>
              <a href={`/tools/${tool.slug}`} className="flex h-full flex-col gap-2 rounded-xl border border-border-hairline bg-surface-card p-6 transition-colors hover:bg-surface-card-hover">
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
        <Reveal>
          <GlowBand>
            <h2 className="text-h1 font-semibold text-balance">Build a better way to study math</h2>
            <p className="max-w-[52ch] text-body-lg text-white/85">
              Unlimited canvases and every answer form on the Free plan — upgrade only for narration,
              video export, and higher limits.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button href={APP_URL} variant="secondary" className="!bg-white !text-accent-blue-600 hover:opacity-90" ctaId="final-cta-start-free">
                Start free
              </Button>
              <Button href="/pricing" variant="ghost" className="!text-white hover:!bg-white/10" ctaId="final-cta-see-pricing">
                See pricing
              </Button>
            </div>
          </GlowBand>
        </Reveal>
        <Reveal index={1} className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-body-sm text-muted-foreground">
          {["Free plan, forever", "No credit card required", "Works on any device"].map((claim) => (
            <span key={claim} className="flex items-center gap-2">
              <Check className="size-4 text-accent-emerald-500" />
              {claim}
            </span>
          ))}
        </Reveal>
      </Section>
    </>
  );
}
