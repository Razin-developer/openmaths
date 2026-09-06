"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Check } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

interface Phase {
  label: string;
  eyebrow: string;
  caption: string;
  accent: string;
}

const PHASES: Phase[] = [
  {
    label: "Reasoning",
    eyebrow: "Step 1",
    caption: "The model reasons through the problem, one step at a time — not a jump straight to an answer.",
    accent: "var(--accent-blue-500)",
  },
  {
    label: "Branching",
    eyebrow: "Step 2",
    caption: "A follow-up worth asking branches into its own connected sub-question, without losing the original.",
    accent: "var(--accent-violet-500)",
  },
  {
    label: "Synthesis",
    eyebrow: "Step 3",
    caption: "The key relationship comes together as a formula — the reasoning made concrete.",
    accent: "var(--gradient-reasoning)",
  },
  {
    label: "Verification",
    eyebrow: "Step 4",
    caption: "The answer is checked across forms — diagram, steps, and plot agree before it's shown to you.",
    accent: "var(--accent-emerald-500)",
  },
];

/** The build-in visual for one phase — driven by `progress` (0-1) within that phase, so the shape
 * assembles in sync with scroll rather than just appearing. */
function PhaseVisual({ phase, progress }: { phase: number; progress: number }) {
  if (phase === 0) {
    return (
      <svg viewBox="0 0 220 140" className="h-36 w-56">
        <rect x="10" y="10" width="140" height="36" rx="8" fill="var(--surface-card)" stroke="var(--border-hairline)" />
        <text x="24" y="33" fontSize="12" fill="var(--foreground)">
          What&apos;s the hypotenuse?
        </text>
        <line
          x1="30"
          y1="46"
          x2="30"
          y2={46 + 30 * Math.min(1, progress * 2)}
          stroke="var(--accent-blue-500)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {progress > 0.5 && (
          <line
            x1="30"
            y1="76"
            x2={30 + 120 * Math.min(1, (progress - 0.5) * 2)}
            y2="76"
            stroke="var(--accent-blue-500)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
      </svg>
    );
  }
  if (phase === 1) {
    return (
      <svg viewBox="0 0 220 160" className="h-36 w-56">
        <rect x="10" y="10" width="120" height="34" rx="8" fill="var(--surface-card)" stroke="var(--border-hairline)" />
        <text x="20" y="32" fontSize="11" fill="var(--foreground)">
          6-8-10 triangle
        </text>
        <line x1="70" y1="44" x2="70" y2="80" stroke="var(--accent-violet-500)" strokeWidth="2" strokeDasharray="4 4" opacity={progress} />
        <g opacity={progress} transform={`translate(0, ${(1 - progress) * -10})`}>
          <rect x="20" y="82" width="150" height="34" rx="8" fill="var(--surface-card)" stroke="var(--accent-violet-500)" />
          <text x="30" y="104" fontSize="11" fill="var(--foreground)">
            What if legs were 5, 12?
          </text>
        </g>
      </svg>
    );
  }
  if (phase === 2) {
    return (
      <div className="flex h-36 w-56 items-center justify-center">
        <p
          className="font-mono-code text-h3 font-semibold"
          style={{ opacity: Math.min(1, progress * 1.5), transform: `scale(${0.85 + Math.min(1, progress * 1.5) * 0.15})` }}
        >
          a² + b² = c²
        </p>
      </div>
    );
  }
  const forms = ["Diagram", "Steps", "Plot"];
  return (
    <div className="flex h-36 w-56 flex-col items-center justify-center gap-3">
      {forms.map((form, i) => {
        const threshold = i / forms.length;
        const active = progress > threshold;
        return (
          <div
            key={form}
            className="flex w-40 items-center justify-between rounded-lg border px-3 py-2 text-body-sm transition-colors duration-base"
            style={{ borderColor: active ? "var(--accent-emerald-500)" : "var(--border-hairline)" }}
          >
            <span>{form}</span>
            {active && <Check className="size-4 text-accent-emerald-500" />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Landing-rework PRD §4.6: a ~350vh pinned scroll sequence, four keyframed phases (Reasoning →
 * Branching → Synthesis → Verification), each with a visual that builds in sync with scroll
 * position via one GSAP ScrollTrigger timeline. Reduced-motion/mobile fallback follows
 * `PinnedSteps`' established pattern: a plain static stacked list, each phase shown in its
 * completed state — pinning IS the effect here, so there's no motion-preserving alternative.
 */
export function ScrollStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setIsMobile(window.matchMedia("(max-width: 640px)").matches);
  }, []);

  const useStatic = reduceMotion || isMobile;

  useEffect(() => {
    if (useStatic || !containerRef.current) return;

    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: `+=${PHASES.length * 100}%`,
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        const raw = self.progress * PHASES.length;
        const index = Math.min(PHASES.length - 1, Math.floor(raw));
        setPhase(index);
        setPhaseProgress(raw - index);
      },
    });

    return () => trigger.kill();
  }, [useStatic]);

  if (useStatic) {
    return (
      <div className="flex flex-col gap-16">
        {PHASES.map((p, i) => (
          <div key={p.label} className="flex flex-col items-center gap-4 text-center">
            <span className="text-caption font-mono-code uppercase tracking-wide" style={{ color: p.accent }}>
              {p.eyebrow} — {p.label}
            </span>
            <PhaseVisual phase={i} progress={1} />
            <p className="max-w-[50ch] text-body text-muted-foreground">{p.caption}</p>
          </div>
        ))}
      </div>
    );
  }

  const current = PHASES[phase];

  return (
    <div ref={containerRef} className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <span className="text-caption font-mono-code uppercase tracking-wide transition-colors duration-base" style={{ color: current.accent }}>
        {current.eyebrow} — {current.label}
      </span>
      <PhaseVisual phase={phase} progress={phaseProgress} />
      <p className="max-w-[50ch] text-body-lg text-muted-foreground">{current.caption}</p>
      <div className="flex gap-2">
        {PHASES.map((p, i) => (
          <div
            key={p.label}
            className="h-1.5 w-10 rounded-pill transition-colors duration-base"
            style={{ background: i === phase ? p.accent : "var(--border-hairline)" }}
          />
        ))}
      </div>
    </div>
  );
}
