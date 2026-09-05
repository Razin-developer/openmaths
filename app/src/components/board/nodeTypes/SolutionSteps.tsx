"use client";

import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Volume2, VolumeX, Loader2, Copy, Check, Sparkles } from "lucide-react";
import type { Components } from "react-markdown";
import type { SolutionStep } from "@/lib/ai/envelope";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNarrationStore, ensureNarration } from "@/store/narrationStore";
import { cn } from "@/lib/utils";
import { api } from "@openmaths/api-client";

const TTS_PROVIDER: "hackai" | "webapi" = process.env.NEXT_PUBLIC_TTS_PROVIDER === "webapi" ? "webapi" : "hackai";

// Stable reference for the no-blockId case — a fresh `{}` literal on every selector call would
// make zustand's snapshot look like it changes every render (same pitfall as annotationStore's
// EMPTY_ANNOTATIONS elsewhere in this codebase).
const NO_NARRATION = { clips: [], loading: false, complete: false } as const;

/** A step's markdown gets the same math/GFM treatment as the main answer, but never the
 * hover-linking components — steps render inside a compact list, not the diagram-adjacent
 * bubble, so wiring label-mention spans here would be dead weight. */
const stepMarkdownComponents: Components = {
  p: ({ children }) => <span>{children}</span>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
};

function StepMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={stepMarkdownComponents}>
      {text}
    </ReactMarkdown>
  );
}

/**
 * The numbered, "Why?"-expandable solution view — one discrete idea per step, with its
 * justification tucked behind a disclosure exactly like the diagram sidebar's existing
 * write_note/reason pattern (GraphAnimationFullscreen.tsx), so it reads as the same affordance
 * the app already teaches users in the animation player.
 *
 * When `blockId` is given (only for answers with no connected diagram — MessageBubble gates
 * this), a compact narration control lets the student listen to the steps read aloud in order,
 * highlighting the active one — a lightweight "stepped reader" for the `solution_steps` form
 * (PRD "Fullscreen Player & Animation UX" §3), reusing the exact same shared narrationStore/
 * `/narrate` route as the diagram player rather than a separate narration pipeline.
 *
 * `explainBlockId` (always the owning question block, unlike `blockId` above — a stuck student
 * can drill into one step even when a diagram is connected) powers per-step "Explain more"
 * (PRD "Explainer Quality, Streaming Stability & Bug Sweep" §6): a focused, on-demand elaboration
 * of just that step, fetched from /api/blocks/[blockId]/explain-step and rendered inline below
 * the step rather than replacing anything already there.
 *
 * `externalActiveStep` (also §6, "sync-highlight") is a step index driven from OUTSIDE this
 * component — the connected GRAPH block's animation player publishes its current scene-step
 * position (scene step i ↔ solution step i, aligned server-side) to boardUiStore, and
 * MessageBubble forwards it here. Kept separate from the internal `activeStep` (driven by this
 * component's own "Listen" narration, only ever set when there's no connected diagram) since the
 * two highlight sources are mutually exclusive in practice but conceptually distinct.
 */
export function SolutionSteps({
  steps,
  finalAnswer,
  blockId,
  explainBlockId,
  externalActiveStep,
}: {
  steps: SolutionStep[];
  finalAnswer?: string | null;
  blockId?: string;
  explainBlockId?: string;
  externalActiveStep?: number | null;
}) {
  const numbered = useMemo(() => steps.map((s, i) => ({ ...s, n: i + 1 })), [steps]);
  const [narrating, setNarrating] = useState(false);
  const [internalActiveStep, setActiveStep] = useState<number | null>(null);
  const activeStep = internalActiveStep ?? (externalActiveStep ?? null);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [explaining, setExplaining] = useState<number | null>(null);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [explainError, setExplainError] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runIdRef = useRef(0);
  const narrationEntry = useNarrationStore((s) => (blockId ? s.get(blockId) : NO_NARRATION));

  function copyStep(step: SolutionStep & { n: number }) {
    const text = [step.claim, step.detail, step.reason].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedStep(step.n);
    setTimeout(() => setCopiedStep((v) => (v === step.n ? null : v)), 1200);
  }

  async function explainStep(step: SolutionStep & { n: number }) {
    if (!explainBlockId || explaining !== null) return;
    setExplaining(step.n);
    setExplainError(null);
    try {
      const otherSteps = numbered.filter((s) => s.n !== step.n).map((s) => s.claim);
      const { text } = await api.blocks.explainStep(explainBlockId, { claim: step.claim, detail: step.detail, reason: step.reason, otherSteps });
      setExplanations((prev) => ({ ...prev, [step.n]: text }));
    } catch {
      setExplainError(step.n);
      setTimeout(() => setExplainError((v) => (v === step.n ? null : v)), 2500);
    } finally {
      setExplaining(null);
    }
  }

  async function playFrom(index: number) {
    const runId = ++runIdRef.current;
    for (let i = index; i < steps.length; i++) {
      if (runId !== runIdRef.current) return;
      setActiveStep(i);
      const clip = useNarrationStore.getState().get(blockId!).clips[i];
      const audio = audioRef.current;
      if (clip && audio) {
        await new Promise<void>((resolve) => {
          audio.src = clip.audioUrl;
          audio.currentTime = 0;
          audio.onended = () => resolve();
          audio.play().catch(() => resolve());
        });
      }
      if (runId !== runIdRef.current) return;
    }
    setNarrating(false);
    setActiveStep(null);
  }

  async function toggleNarrate() {
    if (!blockId) return;
    if (narrating) {
      runIdRef.current++;
      audioRef.current?.pause();
      setNarrating(false);
      setActiveStep(null);
      return;
    }
    setNarrating(true);
    try {
      await ensureNarration(blockId);
      playFrom(0);
    } catch {
      setNarrating(false);
    }
  }

  return (
    <div className="my-1.5 space-y-2">
      {finalAnswer && (
        // "At a glance" (PRD "Explainer Quality, Streaming Stability & Bug Sweep" §6) — the
        // result up front, the worked path below it, for the student who wants the answer before
        // the reasoning. The fuller chip + disclaimer still repeats at the end of the steps.
        <p className="inline-flex items-center gap-1.5 rounded-md bg-accent/60 px-2 py-1 text-xs font-medium">
          <span className="text-muted-foreground">Answer:</span>
          <StepMarkdown text={finalAnswer} />
        </p>
      )}
      {blockId && TTS_PROVIDER !== "webapi" && (
        <>
          <audio ref={audioRef} className="hidden" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={narrating ? "secondary" : "outline"}
                size="sm"
                className="nodrag h-6 gap-1 text-xs"
                onClick={toggleNarrate}
                disabled={narrationEntry.loading && !narrating}
              >
                {narrationEntry.loading && !narrating ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : narrating ? (
                  <Volume2 className="size-3" />
                ) : (
                  <VolumeX className="size-3" />
                )}
                {narrating ? "Listening…" : "Listen"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Read the steps aloud, one at a time</TooltipContent>
          </Tooltip>
        </>
      )}
      <ol className="space-y-2">
        {numbered.map((step) => (
          <li
            key={step.n}
            className={cn("flex gap-2 rounded-md transition-colors", activeStep === step.n - 1 && "bg-accent/60")}
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-medium tabular-nums">
              {step.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className="group/step flex items-start gap-1 font-medium">
                <span className="min-w-0"><StepMarkdown text={step.claim} /></span>
                {explainBlockId && !explanations[step.n] && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="nodrag size-4 shrink-0 opacity-0 group-hover/step:opacity-100"
                        onClick={() => explainStep(step)}
                        disabled={explaining !== null}
                        aria-label="Explain more"
                      >
                        {explaining === step.n ? (
                          <Loader2 className="size-2.5 animate-spin" />
                        ) : (
                          <Sparkles className="size-2.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Explain this step more</TooltipContent>
                  </Tooltip>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="nodrag size-4 shrink-0 opacity-0 group-hover/step:opacity-100"
                  onClick={() => copyStep(step)}
                  aria-label="Copy this step"
                >
                  {copiedStep === step.n ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                </Button>
              </p>
              {step.detail && (
                <div className="mt-0.5 text-muted-foreground">
                  <StepMarkdown text={step.detail} />
                </div>
              )}
              {step.reason && (
                <details className="nodrag mt-0.5">
                  <summary className="cursor-pointer text-xs text-muted-foreground/70 hover:text-foreground">
                    Why?
                  </summary>
                  <p className="mt-0.5 pl-2 text-xs leading-snug text-muted-foreground">
                    <StepMarkdown text={step.reason} />
                  </p>
                </details>
              )}
              {explainError === step.n && (
                <p className="mt-0.5 text-xs text-destructive">Couldn&apos;t get an explanation — try again.</p>
              )}
              {explanations[step.n] && (
                <div className="nodrag mt-1 rounded-md border border-border bg-accent/40 px-1.5 py-1 text-xs leading-snug text-foreground">
                  <StepMarkdown text={explanations[step.n]} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {finalAnswer && (
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium">
            <span className="text-muted-foreground">Answer:</span>
            <StepMarkdown text={finalAnswer} />
          </p>
          {/* PRD v2 §9 — never present an unverified answer as authoritative. Shown once, right
              next to the pinned result (the one place a student is most likely to take the
              answer at face value), not repeated on every message. */}
          <p className="text-[10px] text-muted-foreground/70">AI can make mistakes — check crucial steps.</p>
        </div>
      )}
    </div>
  );
}
