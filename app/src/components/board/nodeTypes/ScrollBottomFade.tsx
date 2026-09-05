"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bottom-edge fade hinting there's more content to scroll to — fades out once the viewport is
 * at (or near) the bottom, so it never sits on top of content the user has already reached. */
export function ScrollBottomFade({ visible, className }: { visible: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex h-9 items-end justify-center gap-1 bg-gradient-to-t from-card via-card/75 to-transparent pb-0.5 transition-opacity duration-200 ease-out",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
        Scroll for more
        <ChevronDown className="size-2.5" />
      </span>
    </div>
  );
}
