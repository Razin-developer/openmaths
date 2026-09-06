import type { Metadata } from "next";
import { Volume2, GitBranch, LayoutGrid, Share2, Download, ShieldCheck } from "lucide-react";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { HeroCanvas } from "@/components/HeroCanvas";
import { CTABand } from "@/components/CTABand";

export const metadata: Metadata = {
  title: "Product",
  description: "How openmaths draws, narrates, and lets you branch every math explanation on a real canvas.",
  alternates: { canonical: "https://openmaths.com/product" },
};

interface FeatureRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  reverse?: boolean;
  media?: React.ReactNode;
}

function FeatureRow({ icon, title, description, reverse, media }: FeatureRowProps) {
  return (
    <div className={`flex flex-col items-center gap-10 md:flex-row ${reverse ? "md:flex-row-reverse" : ""}`}>
      <div className="flex flex-1 flex-col gap-4">
        {icon}
        <h2 className="text-h2 font-semibold text-balance">{title}</h2>
        <p className="text-body-lg text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-1 items-center justify-center">{media}</div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <>
      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">
            Not an answer engine. A tutor that shows its work.
          </h1>
        </Reveal>
      </Section>

      <Section width="wide">
        <Reveal>
          <FeatureRow
            icon={<GitBranch className="size-8 text-accent" />}
            title="The engine draws the proof, not just the answer"
            description="Every geometry question builds its diagram step by step — the same right-angle recognition, area derivation, or graph a human tutor would sketch, drawn live instead of pasted in."
            media={
              <div className="w-full max-w-[420px] overflow-hidden rounded-2xl" style={{ background: "var(--gradient-reasoning)" }}>
                <HeroCanvas />
              </div>
            }
          />
        </Reveal>
      </Section>

      <Section width="wide">
        <Reveal>
          <FeatureRow
            reverse
            icon={<Volume2 className="size-8 text-accent" />}
            title="Narrated, step by step"
            description="Each step is read aloud in sync with the diagram — turn it on from any answer's playback controls. (An embedded audio sample is coming to this page once it's recorded from a real generation.)"
            media={
              <div className="flex h-full w-full max-w-[320px] items-center justify-center rounded-xl border border-dashed border-border-hairline p-12 text-center text-body-sm text-muted-foreground">
                Audio sample — coming soon
              </div>
            }
          />
        </Reveal>
      </Section>

      <Section width="wide">
        <Reveal>
          <FeatureRow
            icon={<LayoutGrid className="size-8 text-accent" />}
            title="One canvas, not a disappearing chat log"
            description="Branch a follow-up into its own connected node, add a plain text note alongside your questions, and come back to the whole thing later — nothing scrolls away."
            media={
              <div className="grid w-full max-w-[320px] grid-cols-3 gap-3">
                {["Question", "Sub-question", "Note"].map((label) => (
                  <div key={label} className="flex aspect-square items-center justify-center rounded-lg border border-border-hairline bg-surface-card text-center text-caption text-muted-foreground">
                    {label}
                  </div>
                ))}
              </div>
            }
          />
        </Reveal>
      </Section>

      <Section width="wide">
        <Reveal>
          <FeatureRow
            reverse
            icon={<Share2 className="size-8 text-accent" />}
            title="Share a canvas, keep control of it"
            description="Invite collaborators by email or a share link, with editor or viewer roles you can change or revoke any time."
            media={<ShieldCheck className="size-24 text-accent-emerald-500" />}
          />
        </Reveal>
      </Section>

      <Section width="wide">
        <Reveal>
          <FeatureRow
            icon={<Download className="size-8 text-accent" />}
            title="Export a walkthrough as video"
            description="Turn any narrated explanation into a video export you can share outside the app — silent or voiced."
            media={<Download className="size-24 text-accent-violet-500" />}
          />
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <CTABand title="See it explain your next question." />
        </Reveal>
      </Section>
    </>
  );
}
