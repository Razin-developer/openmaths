"use client";

import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import type { BlockData } from "@/lib/board/types";
import type { Scene } from "@/lib/dsl/types";
import { MessageBubble } from "@/components/board/nodeTypes/MessageBubble";
import { BouncingDots } from "@/components/board/nodeTypes/BouncingDots";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<"thinking" | "diagram", string> = {
  thinking: "Thinking…",
  diagram: "Creating diagram…",
};

export function ChatThread({
  block,
  onRetry,
  diagramScene,
  diagramBlockId,
  diagramBlocks,
  onAskSameChat,
  onAskNewChat,
  streamingText,
  statusPhase,
}: {
  block: BlockData;
  onRetry?: () => void;
  diagramScene?: Scene | null;
  diagramBlockId?: string | null;
  /** PRD v2 §5 — every connected GRAPH block, passed through to MessageBubble for forms[]
   * messages that carry more than one diagram. */
  diagramBlocks?: BlockData[];
  onAskSameChat?: (selection: string) => void;
  onAskNewChat?: (selection: string) => void;
  streamingText?: string;
  statusPhase?: "thinking" | "diagram" | null;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [block.messages.length, streamingText]);

  if (block.messages.length === 0) {
    return <p className="text-xs text-muted-foreground">Ask a question below to get started.</p>;
  }

  return (
    <div className="space-y-2">
      {block.messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          blockId={block.id}
          diagramScene={diagramScene}
          diagramBlockId={diagramBlockId}
          diagramBlocks={diagramBlocks}
          onAskSameChat={onAskSameChat}
          onAskNewChat={onAskNewChat}
        />
      ))}
      {block.status === "GENERATING" && (
        <div className="flex flex-col items-start gap-1">
          <span className="flex items-center gap-1.5 px-0.5 text-[10.5px] text-muted-foreground">
            {STATUS_LABEL[statusPhase ?? "thinking"]}
            <BouncingDots />
          </span>
          {streamingText ? (
            <MessageBubble
              message={{ id: "streaming", role: "ASSISTANT", content: streamingText, createdAt: new Date().toISOString() }}
              diagramScene={diagramScene}
              diagramBlockId={diagramBlockId}
              isStreaming
            />
          ) : (
            <div className="flex max-w-[85%] flex-col gap-1.5 rounded-lg bg-muted px-2.5 py-2">
              <Skeleton className="h-2.5 w-40" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          )}
        </div>
      )}
      {block.status === "ERROR" && block.errorMessage && (
        <div className="space-y-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[12px] text-muted-foreground">
          <p>{block.errorMessage}</p>
          {onRetry && (
            <Button variant="outline" size="sm" className="nodrag h-6 gap-1 text-xs" onClick={onRetry}>
              <RotateCcw className="size-3" />
              Retry
            </Button>
          )}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
