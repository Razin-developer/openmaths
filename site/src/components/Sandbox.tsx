"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { SegmentedToggle } from "./SegmentedToggle";

interface Step {
  caption: string;
  visual: React.ReactNode;
}

interface Scene {
  id: string;
  label: string;
  question: string;
  steps: Step[];
}

/**
 * Landing-rework PRD §4.5 Phase A: a zero-click sandbox — curated, pre-solved questions the
 * visitor can watch "draw + narrate" without typing anything or signing up. Fully client-side and
 * deterministic (fixed step sequences, no model call), so it's instant and can't be abused or run
 * up cost. Phase B (a real typed-question demo against a rate-limited server endpoint) is
 * explicitly deferred — out of scope here.
 */
const SCENES: Scene[] = [
  {
    id: "triangle",
    label: "Right triangle",
    question: "A right triangle has legs 6 and 8. Find the hypotenuse.",
    steps: [
      {
        caption: "Draw the triangle with the two known legs.",
        visual: (
          <svg viewBox="0 0 160 120" className="h-32 w-40">
            <polyline points="20,20 20,100 140,100" fill="none" stroke="var(--accent-blue-500)" strokeWidth="3" strokeLinecap="round" />
            <text x="4" y="64" fontSize="11" fill="currentColor">6</text>
            <text x="76" y="115" fontSize="11" fill="currentColor">8</text>
          </svg>
        ),
      },
      {
        caption: "Apply the Pythagorean theorem: a² + b² = c².",
        visual: (
          <svg viewBox="0 0 160 120" className="h-32 w-40">
            <polyline points="20,20 20,100 140,100 20,20" fill="none" stroke="var(--accent-blue-500)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text x="4" y="64" fontSize="11" fill="currentColor">6</text>
            <text x="76" y="115" fontSize="11" fill="currentColor">8</text>
            <text x="60" y="55" fontSize="11" fill="var(--accent-violet-500)">c</text>
          </svg>
        ),
      },
      {
        caption: "6² + 8² = 36 + 64 = 100, so c = √100 = 10.",
        visual: (
          <svg viewBox="0 0 160 120" className="h-32 w-40">
            <polyline points="20,20 20,100 140,100 20,20" fill="none" stroke="var(--accent-emerald-500)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text x="4" y="64" fontSize="11" fill="currentColor">6</text>
            <text x="76" y="115" fontSize="11" fill="currentColor">8</text>
            <text x="60" y="55" fontSize="11" fill="var(--accent-emerald-500)" fontWeight="600">10</text>
          </svg>
        ),
      },
    ],
  },
  {
    id: "quadratic",
    label: "Quadratic",
    question: "Solve x² − 5x + 6 = 0.",
    steps: [
      {
        caption: "Look for two numbers that multiply to 6 and add to −5.",
        visual: <p className="font-mono-code text-h4 text-muted-foreground">x² − 5x + 6 = 0</p>,
      },
      {
        caption: "−2 and −3 work: factor as (x − 2)(x − 3) = 0.",
        visual: <p className="font-mono-code text-h4">(x − 2)(x − 3) = 0</p>,
      },
      {
        caption: "Each factor can be zero, so x = 2 or x = 3.",
        visual: <p className="font-mono-code text-h4 text-accent-emerald-500">x = 2  or  x = 3</p>,
      },
    ],
  },
  {
    id: "fraction",
    label: "Fractions",
    question: "Add 3/4 + 1/6.",
    steps: [
      {
        caption: "Find a common denominator — 12 works for both 4 and 6.",
        visual: <p className="font-mono-code text-h4 text-muted-foreground">3/4 + 1/6</p>,
      },
      {
        caption: "Rewrite each fraction over twelfths: 9/12 + 2/12.",
        visual: <p className="font-mono-code text-h4">9/12 + 2/12</p>,
      },
      {
        caption: "Add the numerators: 9/12 + 2/12 = 11/12.",
        visual: <p className="font-mono-code text-h4 text-accent-emerald-500">= 11/12</p>,
      },
    ],
  },
];

export function Sandbox() {
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const [step, setStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0];

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  useEffect(() => clearTimer, []);

  function play() {
    clearTimer();
    if (reduceMotion) {
      setStep(scene.steps.length - 1);
      return;
    }
    setStep(0);
    let i = 0;
    const advance = () => {
      i += 1;
      setStep(i);
      if (i < scene.steps.length - 1) timerRef.current = setTimeout(advance, 1600);
    };
    timerRef.current = setTimeout(advance, 1600);
  }

  function selectScene(id: string) {
    clearTimer();
    const next = SCENES.find((s) => s.id === id) ?? SCENES[0];
    setSceneId(id);
    setStep(reduceMotion ? next.steps.length - 1 : 0);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <SegmentedToggle options={SCENES.map((s) => ({ value: s.id, label: s.label }))} value={sceneId} onChange={selectScene} />
      <div className="w-full max-w-[560px] rounded-2xl border border-border-hairline bg-surface-card p-8">
        <p className="font-mono-code text-body-sm text-muted-foreground">{scene.question}</p>
        <div className="mt-6 flex min-h-[140px] items-center justify-center">{scene.steps[step].visual}</div>
        <p className="mt-6 min-h-[3em] text-center text-body text-foreground" role="status">
          {scene.steps[step].caption}
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={play}
            className="inline-flex items-center gap-2 rounded-pill bg-accent px-5 py-2.5 text-body-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Play className="size-4" fill="currentColor" />
            Watch it solve
          </button>
        </div>
      </div>
    </div>
  );
}
