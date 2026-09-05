"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BoardContext } from "@/components/board/Board";
import { useCreateBlock } from "@/components/board/useCreateBlock";

export function BoardEmptyState({ ctx }: { ctx: BoardContext }) {
  const createBlock = useCreateBlock(ctx);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
      <p className="text-xs text-muted-foreground">Nothing here yet</p>
      <Button size="sm" className="pointer-events-auto gap-1.5 text-xs" onClick={() => createBlock()}>
        <Sparkles className="size-3.5" />
        Ask your first question
      </Button>
    </div>
  );
}
