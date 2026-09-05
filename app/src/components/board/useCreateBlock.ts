"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import type { BoardContext } from "@/components/board/Board";
import { apiBlockToBlockData } from "@/components/board/apiMappers";
import { api } from "@openmaths/api-client";

/** Shared "create a new top-level block at the viewport center" action, used by the Dock and empty-state CTA. */
export function useCreateBlock(ctx: BoardContext, kind?: "NOTE" | "LINK") {
  const { screenToFlowPosition } = useReactFlow();

  return useCallback(
    async (position?: { x: number; y: number }) => {
      const pos = position ?? screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      try {
        const { block } = await api.blocks.create({ canvasId: ctx.canvasId, positionX: pos.x, positionY: pos.y, kind });
        ctx.addNode(apiBlockToBlockData(block as Record<string, unknown>));
      } catch {
        toast.error("Couldn't create a new block");
      }
    },
    [ctx, screenToFlowPosition, kind]
  );
}
