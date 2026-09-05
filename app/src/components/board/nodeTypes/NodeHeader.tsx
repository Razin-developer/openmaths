"use client";

import { ChevronDown, ChevronUp, Copy, Expand, Minimize2, Maximize2, Minimize, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBoardUiStore } from "@/store/boardUiStore";
import { useBlockStore } from "@/store/blockStore";
import { apiBlockToBlockData } from "@/components/board/apiMappers";
import { api } from "@openmaths/api-client";
import { ExportButton } from "@/components/board/nodeTypes/ExportButton";
import { DeleteNodeButton } from "@/components/board/nodeTypes/DeleteNodeButton";
import { NodeTitleEditor } from "@/components/board/nodeTypes/NodeTitleEditor";
import { NodeTypeIcon } from "@/components/board/nodeTypes/NodeTypeIcon";
import type { BlockData } from "@/lib/board/types";
import type { BoardContext } from "@/components/board/Board";

function deriveTitle(block: BlockData): string {
  const raw = block.title || block.prompt || "New question";
  return raw.length > 50 ? `${raw.slice(0, 47)}…` : raw;
}

function HeaderButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function NodeHeader({
  block,
  ctx,
  fullscreenContext = false,
  children,
}: {
  block: BlockData;
  ctx: BoardContext;
  /** True when this header is rendered INSIDE the fullscreen dialog (NodeFullscreen.tsx) rather
   * than the node card itself — adds the windowed/full mode toggle and an explicit close (X),
   * matching the other fullscreen surfaces' contract (PRD "Fullscreen Player & Animation UX"
   * §6.1/§6.3). The node-card header stays exactly as before. */
  fullscreenContext?: boolean;
  /** Extra controls slotted in before the standard button cluster — used by NodeFullscreen for
   * its Chat/Player view toggle, which only makes sense in that context. */
  children?: React.ReactNode;
}) {
  const layout = useBoardUiStore((s) => s.get(block.id).layout);
  const toggleCollapsed = useBoardUiStore((s) => s.toggleCollapsed);
  const fullscreenOpen = useBoardUiStore((s) => s.get(block.id).fullscreen);
  const setFullscreen = useBoardUiStore((s) => s.setFullscreen);
  const fullscreenMode = useBoardUiStore((s) => s.fullscreenMode);
  const toggleFullscreenMode = useBoardUiStore((s) => s.toggleFullscreenMode);
  const pause = useBlockStore((s) => s.pause);
  const collapsed = layout === "collapsed";

  async function handleDuplicate() {
    try {
      const { block: created } = await api.blocks.create({
        canvasId: block.canvasId,
        positionX: block.positionX + 40,
        positionY: block.positionY + 40,
      });
      ctx.addNode(apiBlockToBlockData({ ...(created as Record<string, unknown>), prompt: block.prompt }));
    } catch {
      toast.error("Couldn't duplicate this question");
    }
  }

  async function handleDelete() {
    try {
      await api.blocks.remove(block.id);
      ctx.removeNode(block.id);
    } catch {
      toast.error("Couldn't delete this question");
    }
  }

  return (
    <div className="drag-handle flex cursor-grab items-center justify-between gap-1 border-b border-border px-2.5 py-1.5 active:cursor-grabbing">
      <div className="flex min-w-0 items-center gap-1">
        <NodeTypeIcon kind={block.kind} />
        <NodeTitleEditor blockId={block.id} title={deriveTitle(block)} />
      </div>
      <div className="nodrag flex shrink-0 items-center gap-0.5">
        {children}
        <HeaderButton label={collapsed ? "Expand" : "Collapse"} onClick={() => toggleCollapsed(block.id, pause)}>
          {collapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
        </HeaderButton>
        {!collapsed && (
          <>
            {/* A real toggle — reads live fullscreen state instead of always opening, so clicking
                it from inside the dialog actually closes rather than being a dead no-op click
                (the reported "fullscreen doesn't work reversibly" bug, §6.2). */}
            <HeaderButton
              label={fullscreenOpen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setFullscreen(block.id, !fullscreenOpen)}
            >
              {fullscreenOpen ? <Minimize className="size-3" /> : <Expand className="size-3" />}
            </HeaderButton>
            {fullscreenContext && (
              <HeaderButton
                label={fullscreenMode === "full" ? "Windowed view" : "Edge-to-edge view"}
                onClick={toggleFullscreenMode}
              >
                {fullscreenMode === "full" ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
              </HeaderButton>
            )}
            {ctx.canEdit && (
              <HeaderButton label="Duplicate" onClick={handleDuplicate}>
                <Copy className="size-3" />
              </HeaderButton>
            )}
            <ExportButton block={block} ctx={ctx} />
          </>
        )}
        {fullscreenContext && !collapsed && (
          <HeaderButton label="Close" onClick={() => setFullscreen(block.id, false)}>
            <X className="size-3.5" />
          </HeaderButton>
        )}
        {/* Delete is Editor+ (server-enforced regardless); Viewer/Commenter don't even see the
            control (PRD §7's "read-only board" client reflection). */}
        {ctx.canEdit && <DeleteNodeButton label="this question" onConfirm={handleDelete} />}
      </div>
    </div>
  );
}
