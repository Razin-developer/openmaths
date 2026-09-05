"use client";

import { useEffect } from "react";
import { Hand, MousePointer2, Plus, Maximize, StickyNote, Globe } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import type { BoardContext } from "@/components/board/Board";
import { useBoardUiStore } from "@/store/boardUiStore";
import { useCreateBlock } from "@/components/board/useCreateBlock";
import { isTypingTarget } from "@/lib/board/keyboardGuard";
import { cn } from "@/lib/utils";

function DockButton({
  label,
  shortcut,
  active,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("rounded-full", active && "bg-accent text-accent-foreground")}
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-1.5">
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

export function Dock({ ctx }: { ctx: BoardContext }) {
  const activeTool = useBoardUiStore((s) => s.activeTool);
  const setActiveTool = useBoardUiStore((s) => s.setActiveTool);
  const { fitView } = useReactFlow();
  const createBlock = useCreateBlock(ctx);
  const createNote = useCreateBlock(ctx, "NOTE");
  const createLink = useCreateBlock(ctx, "LINK");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      switch (e.key.toLowerCase()) {
        case "h":
          setActiveTool("pan");
          break;
        case "v":
          setActiveTool("select");
          break;
        case "q":
          createBlock();
          break;
        case "n":
          createNote();
          break;
        case "l":
          createLink();
          break;
        case "f":
          fitView({ duration: 300 });
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTool, createBlock, createNote, createLink, fitView]);

  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5 shadow-md">
      <DockButton label="Pan" shortcut="H" active={activeTool === "pan"} onClick={() => setActiveTool("pan")}>
        <Hand className="size-3.5" />
      </DockButton>
      <DockButton label="Select" shortcut="V" active={activeTool === "select"} onClick={() => setActiveTool("select")}>
        <MousePointer2 className="size-3.5" />
      </DockButton>
      <Separator orientation="vertical" className="h-4" />
      <DockButton label="New block" shortcut="Q" onClick={() => createBlock()}>
        <Plus className="size-3.5" />
      </DockButton>
      <DockButton label="New note" shortcut="N" onClick={() => createNote()}>
        <StickyNote className="size-3.5" />
      </DockButton>
      <DockButton label="New browser" shortcut="L" onClick={() => createLink()}>
        <Globe className="size-3.5" />
      </DockButton>
      <DockButton label="Fit view" shortcut="F" onClick={() => fitView({ duration: 300 })}>
        <Maximize className="size-3.5" />
      </DockButton>
    </div>
  );
}
