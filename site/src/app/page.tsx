import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/Button";

/**
 * A placeholder home, not the real §5.2 page — P1's scope is the foundations (tokens, Nav/Footer,
 * motion setup, SEO infra) proven out by something real, not the full 13-section home stack
 * (hero animation, forms showcase, pinned scroll sequence, etc.), which is P2's job.
 */
export default function HomePage() {
  return (
    <>
      <Section className="relative overflow-hidden">
        <div className="bg-graph-paper pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex flex-col items-center gap-6 text-center">
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
            <Button href="#" variant="secondary">
              See it work
            </Button>
          </Reveal>
        </div>
      </Section>

      <Section>
        <Reveal>
          <p className="text-body-sm text-muted-foreground">
            This is the P1 foundations checkpoint — design tokens, Nav/Footer, motion (Motion +
            GSAP/ScrollTrigger + Lenis), theming, and SEO infra. The real home page (hero product
            animation, forms showcase, pinned &ldquo;how it works&rdquo; sequence) is P2.
          </p>
        </Reveal>
      </Section>
    </>
  );
}
