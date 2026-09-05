"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Copy, Volume2, Check, Shapes } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { getMarkdownComponents } from "@/lib/board/markdown";
import { toSpeechText } from "@/lib/board/speech";
import { splitStreamingMarkdown } from "@/lib/board/streamingMarkdown";
import { splitAtDiagramMarker, stripDiagramMarker } from "@/lib/board/diagramMarker";
import { remarkLabelMentions } from "@/lib/board/remarkLabelMentions";
import { buildLabelMap } from "@/lib/dsl/labelMap";
import type { Scene } from "@/lib/dsl/types";
import type { MessageData, BlockData } from "@/lib/board/types";
import { Button } from "@/components/ui/button";
import { SelectionToolbar } from "@/components/board/nodeTypes/SelectionToolbar";
import { BouncingDots } from "@/components/board/nodeTypes/BouncingDots";
import { SolutionSteps } from "@/components/board/nodeTypes/SolutionSteps";
import { TableForm } from "@/components/board/nodeTypes/TableForm";
import { FormRenderer } from "@/components/board/nodeTypes/FormRenderer";
import { useBoardUiStore } from "@/store/boardUiStore";

function DiagramDrawnCard({ diagramBlockId, ready }: { diagramBlockId?: string | null; ready: boolean }) {
  const setFullscreen = useBoardUiStore((s) => s.setFullscreen);
  const clickable = ready && !!diagramBlockId;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => diagramBlockId && setFullscreen(diagramBlockId, true)}
      className={cn(
        "nodrag my-1 flex w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-left text-[11px] text-muted-foreground",
        clickable && "hover:bg-accent hover:text-foreground"
      )}
    >
      <Shapes className={cn("size-3 shrink-0", !clickable && "animate-pulse")} />
      {clickable ? "Diagram drawn — see the diagram node above" : "Drawing diagram…"}
    </button>
  );
}

export function MessageBubble({
  message,
  blockId,
  diagramScene,
  diagramBlockId,
  diagramBlocks,
  onAskSameChat,
  onAskNewChat,
  isStreaming,
}: {
  message: MessageData;
  /** The owning QUESTION/SUB_QUESTION block's id — used to narrate solution_steps answers that
   * have no connected diagram (PRD "Fullscreen Player & Animation UX" §3). */
  blockId?: string;
  diagramScene?: Scene | null;
  diagramBlockId?: string | null;
  /** Every GRAPH block connected to the owning question — only used when `message.forms` is
   * present (PRD v2 §5), to match each geometry/plot form to its own diagram card. */
  diagramBlocks?: BlockData[];
  onAskSameChat?: (selection: string) => void;
  onAskNewChat?: (selection: string) => void;
  /** True for the in-progress streamed turn — holds back rendering of a dangling, not-yet-closed
   * LaTeX delimiter so partial `$...$`/`$$...$$` never flashes unrendered mid-stream. */
  isStreaming?: boolean;
}) {
  const isUser = message.role === "USER";
  const [copied, setCopied] = useState(false);
  const hasForms = !isStreaming && !!message.forms && message.forms.length > 0;

  const labelMap = useMemo(() => buildLabelMap(diagramScene), [diagramScene]);
  const remarkPlugins = useMemo(
    () => [remarkGfm, remarkMath, () => remarkLabelMentions(labelMap)],
    [labelMap]
  );
  const components = useMemo(
    () => getMarkdownComponents(diagramBlockId ?? null),
    [diagramBlockId]
  );
  // Split on the marker as soon as it appears in the raw content — streaming or not — rather than
  // waiting for the message to finish AND the real diagram to connect (PRD "Explainer Quality,
  // Streaming Stability & Bug Sweep" §4: the answer must never reflow when the diagram lands).
  // Once the split position is decided it never moves again; only the card's `ready` state
  // changes from a "Drawing diagram…" placeholder to clickable once diagramScene actually arrives.
  const rawSplit = useMemo(() => splitAtDiagramMarker(message.content), [message.content]);
  const hasMarker = rawSplit.after !== null;
  const { safe, pending } = useMemo(() => {
    const tail = hasMarker ? rawSplit.after! : rawSplit.before;
    if (isStreaming) return splitStreamingMarkdown(tail);
    return { safe: tail, pending: "" };
  }, [isStreaming, hasMarker, rawSplit]);
  const fullMarkerStripped = useMemo(() => stripDiagramMarker(message.content), [message.content]);
  // A diagram is "connected" the moment the placeholder or real GRAPH node exists (even before
  // its scene is drawn); "ready" gates the card's clickable state. Splitting on `diagramConnected`
  // rather than a scene check keeps the marker-driven layout stable across the placeholder→real
  // swap — see DiagramDrawnCard's `ready` prop.
  const diagramConnected = !!diagramBlockId;
  const diagramReady = diagramConnected && !!diagramScene;
  // Sync-highlight (PRD "Explainer Quality, Streaming Stability & Bug Sweep" §6) — the connected
  // GRAPH block's animation player publishes its current step here; forwarded into SolutionSteps
  // so the answer's matching line highlights as the diagram plays/narrates, even after the
  // fullscreen player closes (last-played step stays highlighted until playback moves again).
  const narratedStepPosition = useBoardUiStore((s) => (diagramBlockId ? s.get(diagramBlockId).narratedStepPosition : null));
  const hasSolution = !isStreaming && !!message.solution && message.solution.length > 0;
  const hasTable = !isStreaming && !!message.table;
  // Expanded by default (PRD "Performance Audit & Answer-Rendering Fix" §A3) — the prose here is
  // the EXACT text the user just watched stream. Collapsing it on completion is the "answer
  // overwrite" bug: streaming shows one thing, the finished message shows a different thing. A
  // "Hide explanation" toggle still exists for users who want the compact view, but nothing the
  // user was reading disappears the moment generation finishes.
  const [showFullExplanation, setShowFullExplanation] = useState(true);

  async function handleCopy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleReadAloud() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(toSpeechText(message.content));
    window.speechSynthesis.speak(utterance);
  }

  const bubble = (
    <div
      className={cn(
        "max-w-[85%] rounded-lg px-2.5 py-1.5 text-[12.5px] leading-relaxed select-text",
        isUser ? "bg-primary text-primary-foreground text-left" : "bg-muted text-foreground"
      )}
    >
      {!isUser && hasTable && !hasSolution && !hasForms && <TableForm table={message.table!} />}
      {isUser ? (
        <p className="whitespace-pre-wrap">{message.content}</p>
      ) : hasForms ? (
        <FormRenderer forms={message.forms!} diagramBlocks={diagramBlocks ?? []} blockId={blockId} />
      ) : hasSolution ? (
        <>
          <SolutionSteps
            steps={message.solution!}
            finalAnswer={message.finalAnswer}
            blockId={!diagramConnected ? blockId : undefined}
            explainBlockId={blockId}
            externalActiveStep={narratedStepPosition}
          />
          {hasTable && <TableForm table={message.table!} />}
          {diagramConnected && <DiagramDrawnCard diagramBlockId={diagramBlockId} ready={diagramReady} />}
          <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5">
            <span className="text-xs font-medium text-muted-foreground">Explanation</span>
            <button
              type="button"
              onClick={() => setShowFullExplanation((v) => !v)}
              className="nodrag text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              {showFullExplanation ? "Hide explanation" : "Show explanation"}
            </button>
          </div>
          {showFullExplanation && (
            <div className="mt-1">
              <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={[rehypeKatex]} components={components}>
                {fullMarkerStripped}
              </ReactMarkdown>
            </div>
          )}
        </>
      ) : hasMarker ? (
        <>
          <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={[rehypeKatex]} components={components}>
            {rawSplit.before}
          </ReactMarkdown>
          <DiagramDrawnCard diagramBlockId={diagramBlockId} ready={diagramReady} />
          <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={[rehypeKatex]} components={components}>
            {safe}
          </ReactMarkdown>
          {isStreaming && pending && <span className="whitespace-pre-wrap">{pending}</span>}
          {isStreaming && <BouncingDots className="ml-1 text-muted-foreground" />}
        </>
      ) : (
        <>
          <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={[rehypeKatex]} components={components}>
            {safe}
          </ReactMarkdown>
          {isStreaming && pending && <span className="whitespace-pre-wrap">{pending}</span>}
          {isStreaming && <BouncingDots className="ml-1 text-muted-foreground" />}
        </>
      )}
    </div>
  );

  if (isStreaming) return bubble;

  return (
    <div className={cn("group/message flex flex-col gap-0.5", isUser ? "items-end" : "items-start")}>
      {onAskSameChat && onAskNewChat ? (
        <SelectionToolbar isUser={isUser} onAskSameChat={onAskSameChat} onAskNewChat={onAskNewChat}>
          {bubble}
        </SelectionToolbar>
      ) : (
        bubble
      )}
      <div className="nodrag flex items-center gap-1 px-0.5 opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100">
        <span className="text-[10px] text-muted-foreground">{timeAgo(new Date(message.createdAt))}</span>
        <Button variant="ghost" size="icon-xs" className="size-4" onClick={handleCopy} aria-label="Copy">
          {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
        </Button>
        {!isUser && (
          <Button variant="ghost" size="icon-xs" className="size-4" onClick={handleReadAloud} aria-label="Read aloud">
            <Volume2 className="size-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
