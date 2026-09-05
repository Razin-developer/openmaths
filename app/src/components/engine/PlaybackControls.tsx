"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import type { Scene } from "@/lib/dsl/types";
import { Button } from "@/components/ui/button";
import { useSceneTimeline } from "@/components/engine/useSceneTimeline";

export function PlaybackControls({ blockId, scene }: { blockId: string; scene: Scene }) {
  const timeline = useSceneTimeline(blockId, scene);
  const isPlaying = timeline.status === "playing";

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="icon-sm" onClick={timeline.reset} aria-label="Restart">
        <RotateCcw className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={timeline.stepBack}
        disabled={timeline.isFirstStep}
        aria-label="Previous step"
      >
        <ChevronLeft className="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={isPlaying ? timeline.pause : timeline.play}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={timeline.stepForward}
        disabled={timeline.isLastStep}
        aria-label="Next step"
      >
        <ChevronRight className="size-3.5" />
      </Button>
      <span className="ml-1 text-[11px] text-muted-foreground">
        Step {timeline.currentStepPosition + 1} / {timeline.steps.length}
      </span>
    </div>
  );
}
