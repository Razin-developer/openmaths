"use client";

import { useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { FilePlus, Globe, Maximize, StickyNote } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useCreateBlock } from "@/components/board/useCreateBlock";
import type { BoardContext } from "@/components/board/Board";

export function CanvasContextMenu({ ctx, children }: { ctx: BoardContext; children: React.ReactNode }) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const createBlock = useCreateBlock(ctx);
  const createNote = useCreateBlock(ctx, "NOTE");
  const createLink = useCreateBlock(ctx, "LINK");
  const lastPointRef = useRef({ x: 0, y: 0 });

  return (
    <ContextMenu>
      <ContextMenuTrigger
        onContextMenu={(e) => {
          lastPointRef.current = { x: e.clientX, y: e.clientY };
        }}
        className="h-full w-full"
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          className="text-xs"
          onSelect={() => createBlock(screenToFlowPosition(lastPointRef.current))}
        >
          <FilePlus className="size-3" /> New question here
        </ContextMenuItem>
        <ContextMenuItem
          className="text-xs"
          onSelect={() => createNote(screenToFlowPosition(lastPointRef.current))}
        >
          <StickyNote className="size-3" /> New note here
        </ContextMenuItem>
        <ContextMenuItem
          className="text-xs"
          onSelect={() => createLink(screenToFlowPosition(lastPointRef.current))}
        >
          <Globe className="size-3" /> New browser here
        </ContextMenuItem>
        <ContextMenuItem className="text-xs" onSelect={() => fitView({ duration: 300 })}>
          <Maximize className="size-3" /> Fit view
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
