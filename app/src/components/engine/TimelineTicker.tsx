"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Scene } from "@/lib/dsl/types";
import { useBlockStore } from "@/store/blockStore";
import { useOpDurations } from "@/components/engine/useSceneTimeline";
import { getOpSteps } from "@/components/engine/timelineUtils";
import { usePrefersReducedMotion } from "@/lib/board/usePrefersReducedMotion";

/** How much faster the construction plays through when the user has asked their OS for reduced
 * motion — large-shortened rather than fully disabled (PRD "UI/UX Polish" §6), so a reduced-
 * motion user still gets to watch the figure build, just compressed to a couple of seconds
 * instead of playing out at full drawing speed. Step controls (jump/scrub) are already instant
 * regardless, so this only affects Play/animateStepForward. */
const REDUCED_MOTION_SPEEDUP = 8;

/** Renders nothing — advances this block's playback state once per frame. Must live inside <Canvas>. */
export function TimelineTicker({ blockId, scene }: { blockId: string; scene: Scene }) {
  const durations = useOpDurations(scene);
  const opSteps = useMemo(() => getOpSteps(scene.ops), [scene]);
  const tick = useBlockStore((s) => s.tick);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((_, delta) => {
    tick(blockId, reducedMotion ? delta * REDUCED_MOTION_SPEEDUP : delta, durations, opSteps);
  });

  return null;
}
