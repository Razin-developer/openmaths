"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface Step {
  title: string;
  description: string;
}

/**
 * "How it works" pinned scroll sequence (PRD §5.2 item 5, §4's named "Apple-style" pattern): the
 * section pins in place while the user scrolls through it, stepping through `steps` in sync with
 * scroll position via one ScrollTrigger driving a GSAP timeline. Falls back to a plain static
 * stacked list under `prefers-reduced-motion` — pinning the viewport IS the motion effect here,
 * there's no reduced version of "pin" that still serves the same purpose.
 */
export function PinnedSteps({ steps }: { steps: Step[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // A lazy useState initializer can't read this safely: it would make the server-rendered
    // markup (pinned/animated, since `window` doesn't exist during SSR) permanently mismatch a
    // real reduced-motion client's actual first-paint intent (the static list), which is a worse
    // problem — a real hydration mismatch — than the one-render-late correction this causes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduceMotion || !containerRef.current) return;

    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: `+=${steps.length * 100}%`,
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        const index = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
        setActiveStep(index);
      },
    });

    return () => trigger.kill();
  }, [reduceMotion, steps.length]);

  if (reduceMotion) {
    return (
      <div className="flex flex-col gap-8">
        {steps.map((step, i) => (
          <div key={step.title} className="flex flex-col gap-2">
            <span className="text-caption font-mono text-accent">Step {i + 1}</span>
            <h3 className="text-h3 font-semibold">{step.title}</h3>
            <p className="text-body text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <span className="text-caption font-mono text-accent">
        Step {activeStep + 1} of {steps.length}
      </span>
      <h3 className="text-h2 font-semibold text-balance">{steps[activeStep].title}</h3>
      <p className="max-w-[50ch] text-body-lg text-muted-foreground">{steps[activeStep].description}</p>
      <div className="flex gap-2">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className={`h-1.5 w-8 rounded-pill transition-colors duration-base ${i === activeStep ? "bg-accent" : "bg-border"}`}
          />
        ))}
      </div>
    </div>
  );
}
