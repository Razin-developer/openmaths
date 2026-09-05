"use client";

import { GitBranch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiBlockToBlockData } from "@/components/board/apiMappers";
import type { BlockData, ConnectionData } from "@/lib/board/types";
import type { BoardContext } from "@/components/board/Board";
import { api } from "@openmaths/api-client";

export function SubQuestionButton({ block, ctx }: { block: BlockData; ctx: BoardContext }) {
  async function handleClick() {
    try {
      const { block: child, connection } = await api.blocks.create({
        canvasId: block.canvasId,
        parentBlockId: block.id,
        positionX: block.positionX + 360,
        positionY: block.positionY,
      });
      ctx.addNode(apiBlockToBlockData(child as Record<string, unknown>));
      if (connection) {
        const conn = connection as ConnectionData;
        ctx.addEdge({ id: conn.id, source: conn.sourceBlockId, target: conn.targetBlockId });
      }
    } catch {
      toast.error("Couldn't create a sub-question");
    }
  }

  return (
    <Button variant="ghost" size="sm" className="nodrag h-6 gap-1 text-xs text-muted-foreground" onClick={handleClick}>
      <GitBranch className="size-3" />
      Sub-question
    </Button>
  );
}
