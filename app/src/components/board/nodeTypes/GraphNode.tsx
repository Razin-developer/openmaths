"use client";

import { memo, useState } from "react";
import dynamic from "next/dynamic";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Film, Minus, Plus, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBoardContext } from "@/components/board/boardContext";
import { useBoardUiStore } from "@/store/boardUiStore";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DiagramErrorBoundary } from "@/components/engine/DiagramErrorBoundary";
import { ensureNarration } from "@/store/narrationStore";
import { BouncingDots } from "@/components/board/nodeTypes/BouncingDots";
import { DeleteNodeButton } from "@/components/board/nodeTypes/DeleteNodeButton";
import { NodeTitleEditor } from "@/components/board/nodeTypes/NodeTitleEditor";
import { NodeTypeIcon } from "@/components/board/nodeTypes/NodeTypeIcon";
import { useCollapseHeight } from "@/components/board/nodeTypes/useCollapseHeight";
import { BlockCanvas } from "@/components/engine/BlockCanvas";
import { api, ApiError } from "@openmaths/api-client";
import type { Scene } from "@/lib/dsl/types";
import {
  DEFAULT_NODE_HEIGHT,
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
  type QuestionFlowNode,
} from "@/components/board/Board";

// PRD "Performance Audit & Answer-Rendering Fix" B5 — GraphAnimationFullscreen (and the three.js +
// R3F it pulls in transitively) still loads lazily, only once a GRAPH node actually mounts.
// BlockCanvas itself stays a static import here: wrapping it in next/dynamic delayed its mount
// past the point where its internal ResizeObserver reliably caught the container's real size,
// leaving the WebGL canvas stuck at the browser's 300x150 default (found via live testing after
// this PRD's first pass — the canvas's own bounding rect never resized even though every ancestor
// div around it measured correctly). Reverted; three.js still avoids canvases with no diagrams
// since GraphNode itself only mounts for GRAPH-kind blocks.
const GraphAnimationFullscreen = dynamic(
  () => import("@/components/board/nodeTypes/GraphAnimationFullscreen").then((m) => m.GraphAnimationFullscreen),
  { ssr: false }
);

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.25;

/** Warm-prefetches narration the moment the user signals intent to open the animation (hover/
 * focus on the Animate button) rather than only after the fullscreen dialog actually opens — by
 * the time they get there, step 0 is usually already synthesized (PRD §5.2). No-op in webapi
 * mode, which has nothing to prefetch. */
function preloadNarration(blockId: string) {
  if (process.env.NEXT_PUBLIC_TTS_PROVIDER === "webapi") return;
  ensureNarration(blockId).catch(() => {});
}

// PRD "Performance Audit & Answer-Rendering Fix" B2 — unmemoized, so any unrelated board
// re-render re-mounted/re-rendered every GRAPH node's full three.js WebGL canvas.
export const GraphNode = memo(function GraphNode({ id, data, selected }: NodeProps<QuestionFlowNode>) {
  const { block } = data;
  const ctx = useBoardContext();
  const setFullscreen = useBoardUiStore((s) => s.setFullscreen);
  const fullscreenOpen = useBoardUiStore((s) => s.get(id).fullscreen);
  const layout = useBoardUiStore((s) => s.get(id).layout);
  const toggleCollapsed = useBoardUiStore((s) => s.toggleCollapsed);
  const collapsed = layout === "collapsed";
  useCollapseHeight(id, collapsed, DEFAULT_NODE_HEIGHT);
  const [zoom, setZoom] = useState(1);
  const [redrawing, setRedrawing] = useState(false);

  async function handleDelete() {
    await api.blocks.remove(block.id).catch(() => {});
    ctx.removeNode(block.id);
  }

  // "Redraw" (PRD "Explainer Quality, Streaming Stability & Bug Sweep" §6) — re-runs just the
  // diagram-drawing stage against the question's already-decided answer, for when a figure comes
  // out cramped/awkward. Never touches the answer text itself, only this block's scene.
  async function handleRedraw() {
    if (redrawing) return;
    setRedrawing(true);
    ctx.updateBlock(block.id, { status: "GENERATING" });
    try {
      const { block: updated } = await api.blocks.redraw(block.id);
      ctx.updateBlock(block.id, { scene: (updated as { scene: Scene }).scene, status: "READY" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't reach the server — check your connection and try again");
      ctx.updateBlock(block.id, { status: "READY" });
    } finally {
      setRedrawing(false);
    }
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        collapsed && "h-auto"
      )}
      style={collapsed ? undefined : { maxHeight: MAX_NODE_HEIGHT }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <NodeResizer
        isVisible={selected && !collapsed}
        minWidth={MIN_NODE_WIDTH}
        minHeight={MIN_NODE_HEIGHT}
        maxWidth={MAX_NODE_WIDTH}
        maxHeight={MAX_NODE_HEIGHT}
        handleClassName="!size-2.5 !rounded-full !border !border-border !bg-background"
        lineClassName="!border-foreground/20"
      />
      <Handle type="target" position={Position.Left} className="!bg-foreground/40" />

      <div className="drag-handle flex cursor-grab items-center justify-between gap-1 border-b border-border px-2.5 py-1.5 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-1">
          <NodeTypeIcon kind={block.kind} />
          <NodeTitleEditor blockId={id} title={block.title || "Diagram"} />
        </div>
        <div className="nodrag flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => toggleCollapsed(id, () => {})}
                aria-label={collapsed ? "Expand" : "Collapse"}
              >
                {collapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{collapsed ? "Expand" : "Collapse"}</TooltipContent>
          </Tooltip>
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setFullscreen(id, !fullscreenOpen)}
                  onMouseEnter={() => preloadNarration(block.id)}
                  onFocus={() => preloadNarration(block.id)}
                  aria-label={fullscreenOpen ? "Exit fullscreen" : "Animate"}
                >
                  <Film className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{fullscreenOpen ? "Exit fullscreen" : "Animate fullscreen"}</TooltipContent>
            </Tooltip>
          )}
          {!collapsed && ctx.canEdit && block.scene && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleRedraw}
                  disabled={redrawing || block.status === "GENERATING"}
                  aria-label="Redraw this diagram"
                >
                  <RefreshCw className={cn("size-3", redrawing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Redraw — try a different construction of the same figure</TooltipContent>
            </Tooltip>
          )}
          {ctx.canEdit && <DeleteNodeButton label="this diagram" onConfirm={handleDelete} />}
        </div>
      </div>

      {!collapsed && (block.scene ? (
        <div className="nodrag nowheel relative min-h-0 flex-1 overflow-hidden p-2">
          <div className="h-full w-full overflow-hidden rounded-md border border-border">
            <DiagramErrorBoundary>
              <BlockCanvas
                blockId={`${block.id}:preview`}
                scene={block.scene}
                mode="static"
                zoomMultiplier={zoom}
                hoverBlockId={block.id}
              />
            </DiagramErrorBoundary>
          </div>
          {block.status === "GENERATING" && (
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 rounded-md bg-popover/90 px-2 py-1 text-[10.5px] text-muted-foreground shadow-sm">
              Updating diagram…
              <BouncingDots />
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-full border border-border bg-popover/90 p-0.5 shadow-sm">
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5 rounded-full"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Zoom out"
            >
              <Minus className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5 rounded-full"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Zoom in"
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      ) : block.status === "GENERATING" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-4 text-center text-xs text-muted-foreground">
          <span>Generating diagram…</span>
          <BouncingDots />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
          No diagram yet.
        </div>
      ))}

      {block.scene && (
        <GraphAnimationFullscreen blockId={block.id} scene={block.scene} title={block.title} narration={block.narration} />
      )}
    </div>
  );
});
