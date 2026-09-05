import { useMemo } from "react";
import type { Scene } from "@/lib/dsl/types";
import { useBlockStore } from "@/store/blockStore";
import { buildStepIndex, getOpDurations } from "@/components/engine/timelineUtils";

/**
 * UI-facing playback controls + derived state for a block's scene.
 * Safe to use outside the R3F <Canvas> tree (e.g. in a DOM controls bar) — the
 * actual per-frame advancement happens in <TimelineTicker>, rendered inside
 * the Canvas, which shares the same zustand store keyed by blockId.
 */
export function useSceneTimeline(blockId: string, scene: Scene) {
  const state = useBlockStore((s) => s.blocks[blockId] ?? s.get(blockId));
  const play = useBlockStore((s) => s.play);
  const playToOpIndex = useBlockStore((s) => s.playToOpIndex);
  const pause = useBlockStore((s) => s.pause);
  const reset = useBlockStore((s) => s.reset);
  const jumpToOpIndex = useBlockStore((s) => s.jumpToOpIndex);
  const setSpeed = useBlockStore((s) => s.setSpeed);
  const setStepDelay = useBlockStore((s) => s.setStepDelay);

  const { steps, firstOpIndexByStep } = useMemo(() => buildStepIndex(scene.ops), [scene]);

  const currentStep = scene.ops[state.currentOpIndex]?.step ?? steps[0] ?? 0;
  const currentStepPosition = steps.indexOf(currentStep);

  function stepForward() {
    const nextStep = steps[currentStepPosition + 1];
    if (nextStep === undefined) return;
    jumpToOpIndex(blockId, firstOpIndexByStep.get(nextStep) ?? 0, scene.ops.length);
  }

  /** Like stepForward, but animates the drawing to the next step instead of jumping instantly. */
  function animateStepForward() {
    const nextStep = steps[currentStepPosition + 1];
    if (nextStep === undefined) return;
    const targetOpIndex = firstOpIndexByStep.get(nextStep);
    if (targetOpIndex === undefined) return;
    playToOpIndex(blockId, targetOpIndex);
  }

  function stepBack() {
    const prevStep = steps[Math.max(currentStepPosition - 1, 0)];
    if (prevStep === undefined) return;
    jumpToOpIndex(blockId, firstOpIndexByStep.get(prevStep) ?? 0, scene.ops.length);
  }

  function scrubToStep(step: number) {
    const opIndex = firstOpIndexByStep.get(step);
    if (opIndex === undefined) return;
    jumpToOpIndex(blockId, opIndex, scene.ops.length);
  }

  function skipToEnd() {
    jumpToOpIndex(blockId, scene.ops.length, scene.ops.length);
  }

  return {
    status: state.status,
    speed: state.speed,
    stepDelay: state.stepDelay,
    hoveredOpId: state.hoveredOpId,
    currentOpIndex: state.currentOpIndex,
    opProgress: state.opProgress,
    steps,
    currentStep,
    currentStepPosition,
    isFirstStep: currentStepPosition <= 0,
    isLastStep: currentStepPosition >= steps.length - 1,
    play: () => play(blockId),
    pause: () => pause(blockId),
    reset: () => reset(blockId),
    stepForward,
    animateStepForward,
    stepBack,
    scrubToStep,
    skipToEnd,
    setSpeed: (speed: number) => setSpeed(blockId, speed),
    setStepDelay: (delay: number) => setStepDelay(blockId, delay),
  };
}

export function useOpDurations(scene: Scene): number[] {
  return useMemo(() => getOpDurations(scene.ops), [scene]);
}
