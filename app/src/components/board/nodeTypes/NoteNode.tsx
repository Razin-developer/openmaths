"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronUp, Expand, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import { useBoardContext } from "@/components/board/boardContext";
import { useBoardUiStore } from "@/store/boardUiStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiBlockToBlockData } from "@/components/board/apiMappers";
import { api } from "@openmaths/api-client";
import { markdownComponents } from "@/lib/board/markdown";
import { DeleteNodeButton } from "@/components/board/nodeTypes/DeleteNodeButton";
import { NodeTitleEditor } from "@/components/board/nodeTypes/NodeTitleEditor";
import { NodeTypeIcon } from "@/components/board/nodeTypes/NodeTypeIcon";
import { NoteFullscreen } from "@/components/board/nodeTypes/NoteFullscreen";
import { ScrollBottomFade } from "@/components/board/nodeTypes/ScrollBottomFade";
import { streamToBlock } from "@/lib/board/streamMessages";
import { useCollapseHeight } from "@/components/board/nodeTypes/useCollapseHeight";
import { useAutoGrowHeight } from "@/components/board/nodeTypes/useAutoGrowHeight";
import {
  DEFAULT_NODE_HEIGHT,
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
  type QuestionFlowNode,
} from "@/components/board/Board";

const SAVE_DEBOUNCE_MS = 600;
const SCROLL_BOTTOM_THRESHOLD_PX = 48;
// Header (~37px) + the text area's own vertical padding (2 x 10px) — no PromptInput/footer here.
const NOTE_CHROME_HEIGHT = 57;

function HeaderButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" onClick={onClick} disabled={disabled} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

// PRD "Performance Audit & Answer-Rendering Fix" B2 — unmemoized, so any unrelated board
// re-render re-rendered every note (markdown + KaTeX) regardless of viewport visibility.
export const NoteNode = memo(function NoteNode({ id, data, selected }: NodeProps<QuestionFlowNode>) {
  const { block } = data;
  const ctx = useBoardContext();
  const layout = useBoardUiStore((s) => s.get(id).layout);
  const toggleCollapsed = useBoardUiStore((s) => s.toggleCollapsed);
  const setFullscreen = useBoardUiStore((s) => s.setFullscreen);
  const setManuallyResized = useBoardUiStore((s) => s.setManuallyResized);
  const manuallyResized = useBoardUiStore((s) => s.get(id).manuallyResized);
  const collapsed = layout === "collapsed";
  useCollapseHeight(id, collapsed, DEFAULT_NODE_HEIGHT);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [asking, setAsking] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showScrollFade, setShowScrollFade] = useState(false);
  useAutoGrowHeight(id, contentRef, {
    chromeHeight: NOTE_CHROME_HEIGHT,
    minHeight: MIN_NODE_HEIGHT,
    maxHeight: MAX_NODE_HEIGHT,
    enabled: !manuallyResized && !collapsed && block.status !== "GENERATING",
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function handleScroll() {
      const distanceFromBottom = el!.scrollHeight - el!.scrollTop - el!.clientHeight;
      setShowScrollFade(distanceFromBottom > SCROLL_BOTTOM_THRESHOLD_PX);
    }
    handleScroll();
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [block.prompt, collapsed]);

  function handleChange(next: string) {
    ctx.updateBlock(id, { prompt: next });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.blocks.update(id, { prompt: next, title: block.title || next.slice(0, 60) || null }).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  }

  async function handleDelete() {
    await api.blocks.remove(id).catch(() => {});
    ctx.removeNode(id);
  }

  async function handleAskAI() {
    const prompt = block.prompt.trim();
    if (!prompt) {
      toast.error("Write something in the note first");
      return;
    }
    setAsking(true);
    try {
      let created: Record<string, unknown> & { id: string };
      try {
        const result = await api.blocks.create({
          canvasId: block.canvasId,
          positionX: block.positionX + 360,
          positionY: block.positionY,
        });
        created = result.block as Record<string, unknown> & { id: string };
      } catch {
        toast.error("Couldn't create a question");
        return;
      }
      ctx.addNode(apiBlockToBlockData(created));

      // PRD "Split into app + server" P3-continued round 3 — cut over to the base-URL client.
      try {
        const { connection } = await api.connections.create({ canvasId: block.canvasId, sourceBlockId: id, targetBlockId: created.id });
        const conn = connection as { id: string; sourceBlockId: string; targetBlockId: string };
        ctx.addEdge({ id: conn.id, source: conn.sourceBlockId, target: conn.targetBlockId });
      } catch {
        // Same tolerant behavior as before — a failed connection doesn't block the question itself.
      }

      ctx.updateBlock(created.id, { status: "GENERATING" });
      await streamToBlock(
        created.id,
        prompt,
        undefined,
        (event) => {
          if (event.type === "done" || event.type === "error") {
            ctx.updateBlock(created.id, apiBlockToBlockData(event.block));
          }
          if (event.type === "done") {
            // See NodeBody.tsx's identical fallback comment — graphSyncs (plural) carries every
            // diagram for a multi-diagram forms[] answer; the common single-diagram case still
            // only sets graphBlock/graphConnection.
            const graphSyncEntries =
              event.graphSyncs && event.graphSyncs.length > 0
                ? event.graphSyncs
                : event.graphBlock
                  ? [{ graphBlock: event.graphBlock, graphConnection: event.graphConnection ?? null }]
                  : [];
            for (const entry of graphSyncEntries) {
              ctx.upsertNode(
                apiBlockToBlockData(entry.graphBlock),
                entry.graphConnection
                  ? {
                      id: entry.graphConnection.id as string,
                      canvasId: entry.graphConnection.canvasId as string,
                      sourceBlockId: entry.graphConnection.sourceBlockId as string,
                      targetBlockId: entry.graphConnection.targetBlockId as string,
                      label: (entry.graphConnection.label as string | null) ?? null,
                    }
                  : null
              );
            }
          }
          if (event.type === "done" && event.webLinkBlock) {
            ctx.upsertNode(
              apiBlockToBlockData(event.webLinkBlock),
              event.webLinkConnection
                ? {
                    id: event.webLinkConnection.id as string,
                    canvasId: event.webLinkConnection.canvasId as string,
                    sourceBlockId: event.webLinkConnection.sourceBlockId as string,
                    targetBlockId: event.webLinkConnection.targetBlockId as string,
                    label: (event.webLinkConnection.label as string | null) ?? null,
                  }
                : null
            );
          }
          if (event.type === "done") {
            for (const skipped of event.webLinkSkipped ?? []) {
              toast.error(`Couldn't add ${skipped.url} — ${skipped.reason}`);
            }
          }
        },
        { casual: true }
      );
    } catch {
      toast.error("Couldn't reach the server — check your connection and try again");
    } finally {
      setAsking(false);
    }
  }

  const title = block.title || (block.prompt ? block.prompt.slice(0, 50) : "Note");

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm"
      )}
      style={{ maxHeight: MAX_NODE_HEIGHT }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_NODE_WIDTH}
        minHeight={MIN_NODE_HEIGHT}
        maxWidth={MAX_NODE_WIDTH}
        maxHeight={MAX_NODE_HEIGHT}
        onResize={() => setManuallyResized(id)}
        handleClassName="!size-2.5 !rounded-full !border !border-border !bg-background"
        lineClassName="!border-foreground/20"
      />
      <Handle type="source" position={Position.Right} className="!bg-foreground/40" />

      <div className="drag-handle flex cursor-grab items-center justify-between gap-1 border-b border-border px-2.5 py-1.5 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-1">
          <NodeTypeIcon kind={block.kind} />
          <NodeTitleEditor blockId={id} title={title} />
        </div>
        <div className="nodrag flex shrink-0 items-center gap-0.5">
          <HeaderButton label={collapsed ? "Expand" : "Collapse"} onClick={() => toggleCollapsed(id, () => {})}>
            {collapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
          </HeaderButton>
          {!collapsed && (
            <>
              <HeaderButton label="Fullscreen" onClick={() => setFullscreen(id, true)}>
                <Expand className="size-3" />
              </HeaderButton>
              <HeaderButton label="Ask AI about this note" onClick={handleAskAI} disabled={asking}>
                <Sparkles className={cn("size-3", asking && "animate-pulse")} />
              </HeaderButton>
            </>
          )}
          {ctx.canEdit && <DeleteNodeButton label="this note" onConfirm={handleDelete} />}
        </div>
      </div>

      {!collapsed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative min-h-0 flex-1">
              <ScrollArea className="nowheel h-full" viewportRef={viewportRef}>
                <div
                  ref={contentRef}
                  role="button"
                  tabIndex={0}
                  onClick={() => setFullscreen(id, true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setFullscreen(id, true);
                  }}
                  className="nodrag w-full cursor-text px-3 py-2.5 text-left text-xs leading-relaxed"
                >
                  {block.prompt.trim() ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {block.prompt}
                    </ReactMarkdown>
                  ) : (
                    <span className="text-muted-foreground">
                      Empty note — click to open fullscreen and start writing…
                    </span>
                  )}
                </div>
              </ScrollArea>
              <ScrollBottomFade visible={showScrollFade} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex items-center gap-1">
            <PenLine className="size-3" />
            Open fullscreen to edit
          </TooltipContent>
        </Tooltip>
      )}

      <NoteFullscreen blockId={id} content={block.prompt} onChange={handleChange} canEdit={ctx.canEdit} />
    </div>
  );
});
