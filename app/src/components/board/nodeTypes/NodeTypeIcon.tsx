import { HelpCircle, Shapes, StickyNote, Globe, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockKind } from "@/lib/board/types";

const ICON_BY_KIND: Record<BlockKind, LucideIcon> = {
  QUESTION: HelpCircle,
  SUB_QUESTION: HelpCircle,
  GRAPH: Shapes,
  NOTE: StickyNote,
  LINK: Globe,
};

export function NodeTypeIcon({ kind, className }: { kind: BlockKind; className?: string }) {
  const Icon = ICON_BY_KIND[kind];
  return <Icon className={cn("size-3 shrink-0 text-muted-foreground", className)} />;
}
