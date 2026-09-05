"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A continuous progress bar with step/chapter markers — click/drag anywhere to seek to the
 * nearest unit, or click a marker to jump straight to that step (PRD "Fullscreen Player &
 * Animation UX" §4.1). Shared between `GraphAnimationFullscreen` (units = drawing ops, so a step
 * with more ops occupies proportionally more of the bar) and `FullscreenPlayer` (units = steps
 * themselves, one-to-one, for solution_steps/table forms that have no op-level granularity) —
 * genuinely reused, not duplicated, per the "reuses the scrubber/speed/export chrome" ask.
 */
export function PlayerScrubber({
  totalUnits,
  currentUnit,
  unitProgress,
  stepStartUnits,
  currentStepPosition,
  onSeek,
  onSeekStep,
  disabled,
}: {
  /** Total granularity units the fill bar spans — drawing ops for a diagram, or just the step
   * count for DOM-rendered steps. */
  totalUnits: number;
  /** Current unit index (0-based). */
  currentUnit: number;
  /** 0-1 progress within `currentUnit` — always 0 for step-granularity callers. */
  unitProgress: number;
  /** The unit index each step begins at, one entry per step, ascending — for a step-granularity
   * caller this is just `[0, 1, 2, ...]`. */
  stepStartUnits: number[];
  currentStepPosition: number;
  /** Called with the nearest unit index on click/drag anywhere on the track. */
  onSeek: (unitIndex: number) => void;
  /** Called with the step position when a marker is clicked directly. */
  onSeekStep: (stepPosition: number) => void;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fraction = totalUnits > 0 ? Math.min(1, (currentUnit + unitProgress) / totalUnits) : 0;

  function seekAtClientX(clientX: number) {
    const track = trackRef.current;
    if (!track || totalUnits === 0) return;
    const rect = track.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(Math.round(f * (totalUnits - 1)));
  }

  return (
    <div className="nodrag flex items-center gap-2 px-4 py-1.5">
      <div
        ref={trackRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.max(stepStartUnits.length - 1, 0)}
        aria-valuenow={currentStepPosition}
        tabIndex={disabled ? -1 : 0}
        className={cn("relative h-1.5 flex-1 rounded-full bg-muted", disabled ? "pointer-events-none opacity-50" : "cursor-pointer")}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          seekAtClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (disabled || e.buttons !== 1) return;
          seekAtClientX(e.clientX);
        }}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-foreground/70" style={{ width: `${fraction * 100}%` }} />
        {stepStartUnits.map((unitIndex, i) => {
          const left = totalUnits > 0 ? (unitIndex / totalUnits) * 100 : 0;
          return (
            <button
              key={`marker-${i}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSeekStep(i);
              }}
              aria-label={`Jump to step ${i + 1}`}
              className={cn(
                "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background",
                i <= currentStepPosition ? "bg-foreground/70" : "bg-muted-foreground/40"
              )}
              style={{ left: `${left}%` }}
            />
          );
        })}
      </div>
      <span className="w-14 shrink-0 text-right text-[10.5px] tabular-nums text-muted-foreground">
        {currentStepPosition + 1}/{stepStartUnits.length}
      </span>
    </div>
  );
}

/** Speed presets (0.5×/1×/1.5×/2×) plus a fine slider — shared between the diagram player (where
 * "speed" scales op drawing time) and `FullscreenPlayer` (where it scales the per-step hold
 * duration). */
export function PlayerSpeedControl({ speed, onChange }: { speed: number; onChange: (speed: number) => void }) {
  const PRESETS = [0.5, 1, 1.5, 2];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={cn(
              "h-6 flex-1 rounded-md border text-xs",
              speed === preset ? "border-transparent bg-secondary text-secondary-foreground" : "border-border hover:bg-accent"
            )}
          >
            {preset}×
          </button>
        ))}
      </div>
    </div>
  );
}
