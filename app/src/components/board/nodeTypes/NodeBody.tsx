"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { BlockData, ConnectionData } from "@/lib/board/types";
import { api } from "@openmaths/api-client";
import type { MessageAttachment } from "@/lib/ai/attachments";
import type { BoardContext } from "@/components/board/Board";
import { apiBlockToBlockData } from "@/components/board/apiMappers";
import { ChatThread } from "@/components/board/nodeTypes/ChatThread";
import { PromptInput } from "@/components/board/nodeTypes/PromptInput";
import { SubQuestionButton } from "@/components/board/nodeTypes/SubQuestionButton";
import { ScrollBottomFade } from "@/components/board/nodeTypes/ScrollBottomFade";
import { streamToBlock } from "@/lib/board/streamMessages";
import { useStreamingStore } from "@/store/streamingStore";
import { useAnnotationStore } from "@/store/annotationStore";
import { useBoardUiStore } from "@/store/boardUiStore";
import { useUsageMeterStore } from "@/store/usageMeterStore";
import { useAutoGrowHeight } from "@/components/board/nodeTypes/useAutoGrowHeight";
import { MAX_NODE_HEIGHT, MIN_NODE_HEIGHT } from "@/components/board/Board";

const SCROLL_BOTTOM_THRESHOLD_PX = 48;
// Header (~37px) + PromptInput area (~92px) + the body's own vertical padding (2 x 10px) — the
// fixed chrome around the scrollable message list that useAutoGrowHeight needs to add to the
// content's natural height to get the total node height content actually needs.
const CHAT_CHROME_HEIGHT = 149;

/** Display label for a connected node in the @ mention list — matches each node type's own
 * title-fallback convention (see GraphNode/NoteNode/WebLinkNode headers). */
function mentionTitleFor(b: BlockData): string | null {
  if (b.kind === "GRAPH") return (b.title || "Diagram").replace(/^Diagram:\s*/i, "").trim() || null;
  if (b.kind === "NOTE") return (b.title || (b.prompt ? b.prompt.slice(0, 50) : "Note")).trim() || null;
  if (b.kind === "LINK") {
    if (b.title) return b.title;
    const firstUrl = b.tabs?.[0]?.url ?? b.prompt;
    if (!firstUrl) return "Web Browser";
    try {
      return new URL(firstUrl).hostname.replace(/^www\./, "");
    } catch {
      return "Web Browser";
    }
  }
  return (b.title || b.prompt || null)?.toString().slice(0, 50) || null;
}

export function NodeBody({
  block,
  ctx,
  autoFocusInput,
}: {
  block: BlockData;
  ctx: BoardContext;
  autoFocusInput?: boolean;
}) {
  const graphBlock = ctx.getConnectedGraphBlock(block.id);
  const graphBlocks = ctx.getConnectedGraphBlocks(block.id);
  const mentionables = ctx
    .getConnectedBlocks(block.id)
    .map((b) => ({ kind: b.kind, title: mentionTitleFor(b) }))
    .filter((m): m is { kind: BlockData["kind"]; title: string } => !!m.title);
  const { text: streamingText, phase: statusPhase } = useStreamingStore((s) => s.get(block.id));
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const manuallyResized = useBoardUiStore((s) => s.get(block.id).manuallyResized);
  // Frozen during generation (PRD "Explainer Quality, Streaming Stability & Bug Sweep" §3): the
  // ResizeObserver would otherwise fire on every streamed token and lurch the node up to
  // MAX_NODE_HEIGHT token-by-token. The node holds a stable height with internal scroll while
  // streaming, then grows once — the effect's own mount-time measure() — the moment `enabled`
  // flips back to true on completion.
  useAutoGrowHeight(block.id, contentRef, {
    chromeHeight: CHAT_CHROME_HEIGHT,
    minHeight: MIN_NODE_HEIGHT,
    maxHeight: MAX_NODE_HEIGHT,
    enabled: !manuallyResized && block.status !== "GENERATING",
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function handleScroll() {
      const distanceFromBottom = el!.scrollHeight - el!.scrollTop - el!.clientHeight;
      setShowScrollToBottom(distanceFromBottom > SCROLL_BOTTOM_THRESHOLD_PX);
    }
    handleScroll();
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [block.messages.length, streamingText]);

  function scrollToBottom() {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
  }

  const placeholderGraphIdRef = useRef<string | null>(null);

  function cleanupPlaceholderGraph() {
    if (placeholderGraphIdRef.current) {
      ctx.removeNode(placeholderGraphIdRef.current);
      placeholderGraphIdRef.current = null;
    }
  }

  async function handleSend(
    content: string,
    attachments?: MessageAttachment[],
    options?: { webSearch?: boolean; skillId?: string }
  ) {
    ctx.updateBlock(block.id, {
      status: "GENERATING",
      messages: [
        ...block.messages,
        { id: `optimistic-${Date.now()}`, role: "USER", content, createdAt: new Date().toISOString() },
      ],
    });

    try {
      await streamToBlock(
        block.id,
        content,
        attachments,
        (event) => {
        if (event.type === "status" && event.phase === "diagram") {
          const existingGraph = ctx.getConnectedGraphBlock(block.id);
          if (existingGraph) {
            ctx.updateBlock(existingGraph.id, { status: "GENERATING" });
          } else if (!placeholderGraphIdRef.current) {
            const tempId = `pending-graph-${block.id}`;
            placeholderGraphIdRef.current = tempId;
            // Match graphSync.ts's real-node offset (existingConnections.length * 40) so the
            // placeholder doesn't hop to a different y once the real diagram node lands (PRD
            // "Explainer Quality, Streaming Stability & Bug Sweep" §7).
            const existingGraphCount = ctx.getConnectedBlocks(block.id).filter((b) => b.kind === "GRAPH").length;
            ctx.addNode({
              id: tempId,
              canvasId: block.canvasId,
              parentBlockId: null,
              kind: "GRAPH",
              status: "GENERATING",
              title: null,
              prompt: "",
              modelId: null,
              reasoningEffort: null,
              scene: null,
              errorMessage: null,
              positionX: block.positionX + 360,
              positionY: block.positionY + existingGraphCount * 40,
              messages: [],
            });
            ctx.addEdge({ id: `pending-edge-${block.id}`, source: block.id, target: tempId });
          }
        } else if (event.type === "done") {
          ctx.updateBlock(block.id, apiBlockToBlockData(event.block));
          cleanupPlaceholderGraph();
          // Near-real-time live meter (PRD "User System — Usage Metering & Notifications" §4.4)
          // instead of waiting up to 30s for the meter's own poll to catch this generation's cost.
          useUsageMeterStore.getState().bump();
          // PRD v2 §5 — a forms[] answer with more than one diagram carries graphSyncs (plural);
          // the single-diagram case (flat scene, or a single-form forms[] answer) still only sets
          // graphBlock/graphConnection, so this falls back to that pair unchanged.
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
          if (event.webLinkBlock) {
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
          for (const skipped of event.webLinkSkipped ?? []) {
            toast.error(`Couldn't add ${skipped.url} — ${skipped.reason}`);
          }
        } else if (event.type === "error") {
          ctx.updateBlock(block.id, apiBlockToBlockData(event.block));
          cleanupPlaceholderGraph();
          const existingGraph = ctx.getConnectedGraphBlock(block.id);
          if (existingGraph && existingGraph.status === "GENERATING") {
            ctx.updateBlock(existingGraph.id, { status: "READY" });
          }
          toast.error(event.error || "Generation failed");
        }
        },
        { webSearch: options?.webSearch, skillId: options?.skillId }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't reach the server — check your connection and try again";
      toast.error(message);
      ctx.updateBlock(block.id, { status: "ERROR", errorMessage: message });
      cleanupPlaceholderGraph();
    }
  }

  function handleRetry() {
    const lastUserMessage = [...block.messages].reverse().find((m) => m.role === "USER");
    if (lastUserMessage) handleSend(lastUserMessage.content);
  }

  async function handleReasoningEffortChange(reasoningEffort: string) {
    ctx.updateBlock(block.id, { reasoningEffort });
    try {
      await api.blocks.update(block.id, { reasoningEffort });
    } catch {
      toast.error("Couldn't save the reasoning level");
    }
  }

  // Selected text becomes an "annotation" attachment — it's picked up by this block's own
  // PromptInput (see the annotationStore subscription there) and shown as a removable chip,
  // NOT sent immediately. The student still has to type a question and hit send.
  function handleAskSameChat(selection: string) {
    useAnnotationStore.getState().addPending(block.id, [{ type: "annotation", text: selection }]);
  }

  async function handleAskNewChat(selection: string) {
    try {
      const { block: child, connection } = await api.blocks.create({
        canvasId: block.canvasId,
        parentBlockId: block.id,
        positionX: block.positionX + 360,
        positionY: block.positionY + 120,
      });
      // The new node opens empty with the annotation pre-attached and connected — not auto-asked.
      useAnnotationStore.getState().addPending((child as { id: string }).id, [{ type: "annotation", text: selection }]);
      ctx.upsertNode(apiBlockToBlockData(child as Record<string, unknown>), (connection as ConnectionData | null) ?? null);
    } catch {
      toast.error("Couldn't create a sub-question");
    }
  }

  const isEmpty = block.messages.length === 0 && block.status !== "GENERATING";

  if (isEmpty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 p-2.5">
        {ctx.canEdit ? (
          <PromptInput
            block={block}
            autoFocus={autoFocusInput}
            onReasoningEffortChange={handleReasoningEffortChange}
            onSend={handleSend}
            mentionables={mentionables}
          />
        ) : (
          <p className="text-center text-xs text-muted-foreground">Nothing here yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2 p-2.5">
      <div className="relative min-h-0 flex-1">
        <ScrollArea className="nowheel h-full" viewportRef={viewportRef}>
          <div ref={contentRef} className="flex flex-col gap-2 pr-2">
            <ChatThread
              block={block}
              onRetry={handleRetry}
              diagramScene={graphBlock?.scene}
              diagramBlockId={graphBlock?.id}
              diagramBlocks={graphBlocks}
              onAskSameChat={handleAskSameChat}
              onAskNewChat={handleAskNewChat}
              streamingText={streamingText}
              statusPhase={statusPhase}
            />
            {block.messages.length > 0 && ctx.canEdit && (
              <div className="flex items-center gap-1.5">
                <SubQuestionButton block={block} ctx={ctx} />
              </div>
            )}
          </div>
        </ScrollArea>
        <ScrollBottomFade visible={showScrollToBottom} />
      </div>
      {showScrollToBottom && (
        <Button
          variant="outline"
          size="icon-sm"
          className="nodrag absolute bottom-14 left-1/2 z-10 -translate-x-1/2 rounded-full bg-card shadow-md"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="size-3.5" />
        </Button>
      )}
      {/* Read-only board — no prompt input for Viewer/Commenter (PRD "Sharing, Collaboration &
          Access Roles" §7). The server enforces this regardless; hiding it here is UX, not the
          security boundary. */}
      {ctx.canEdit && (
        <PromptInput
          block={block}
          autoFocus={autoFocusInput}
          onReasoningEffortChange={handleReasoningEffortChange}
          onSend={handleSend}
          mentionables={mentionables}
        />
      )}
    </div>
  );
}
