"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useBlockStore } from "@/store/blockStore";

/** Plain-text (non-Markdown) version of the answer's label-mention hover-linking, for the NotesPanel/step lists. */
export function HighlightableText({
  text,
  labelMap,
  blockId,
}: {
  text: string;
  labelMap: Map<string, string>;
  blockId: string;
}) {
  const hoveredOpId = useBlockStore((s) => (s.blocks[blockId] ?? s.get(blockId)).hoveredOpId);
  const setHovered = useBlockStore((s) => s.setHovered);

  const pattern = useMemo(() => {
    const labels = Array.from(labelMap.keys())
      .filter((l) => l.trim().length > 0)
      .sort((a, b) => b.length - a.length);
    if (labels.length === 0) return null;
    const escaped = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join("|")})(?![\\p{L}\\p{N}])`, "gu");
  }, [labelMap]);

  if (!pattern) return <>{text}</>;

  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) => {
        const opId = labelMap.get(part);
        if (!opId) return <span key={index}>{part}</span>;
        const hovered = hoveredOpId === opId;
        return (
          <span
            key={index}
            className={cn(
              "cursor-default rounded px-0.5 underline decoration-dotted decoration-muted-foreground underline-offset-2",
              hovered && "bg-accent font-medium text-accent-foreground"
            )}
            onMouseEnter={() => setHovered(blockId, opId)}
            onMouseLeave={() => setHovered(blockId, null)}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}
