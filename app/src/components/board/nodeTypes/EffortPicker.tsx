"use client";

import { HelpCircle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const REASONING_LEVELS = ["low", "medium", "high"] as const;
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

const LEVEL_LABEL: Record<ReasoningLevel, string> = { low: "Low", medium: "Medium", high: "High" };

export function EffortPicker({
  value,
  onChange,
}: {
  value: ReasoningLevel;
  onChange: (level: ReasoningLevel) => void;
}) {
  const index = Math.max(0, REASONING_LEVELS.indexOf(value));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="nodrag rounded px-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {LEVEL_LABEL[value]}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="nodrag w-56 space-y-3 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Effort <span className="text-muted-foreground">{LEVEL_LABEL[value]}</span>
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="size-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-48 text-xs">
              Higher effort spends more time reasoning before answering — slower, but more likely to be
              correct on harder problems.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Faster</span>
          <span>Smarter</span>
        </div>
        <div className="px-0.5 py-1">
          <Slider
            value={[index]}
            min={0}
            max={REASONING_LEVELS.length - 1}
            step={1}
            onValueChange={([v]) => onChange(REASONING_LEVELS[v])}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
