"use client";

import { memo } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useBoardUiStore } from "@/store/boardUiStore";
import { useBoardContext } from "@/components/board/boardContext";
import { NodeHeader } from "@/components/board/nodeTypes/NodeHeader";
import { NodeBody } from "@/components/board/nodeTypes/NodeBody";
import { NodeFullscreen } from "@/components/board/nodeTypes/NodeFullscreen";
import { useCollapseHeight } from "@/components/board/nodeTypes/useCollapseHeight";
import {
  DEFAULT_NODE_HEIGHT,
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
  type QuestionFlowNode,
} from "@/components/board/Board";

// PRD "Performance Audit & Answer-Rendering Fix" B2 — none of the four node types were memoized,
// so any unrelated board re-render re-rendered every mounted node (including off-screen ones,
// each running ReactMarkdown+KaTeX or a full three.js canvas).
export const QuestionNode = memo(function QuestionNode({ id, data, selected }: NodeProps<QuestionFlowNode>) {
  const { block } = data;
  const layout = useBoardUiStore((s) => s.get(id).layout);
  const setManuallyResized = useBoardUiStore((s) => s.setManuallyResized);
  const ctx = useBoardContext();
  useCollapseHeight(id, layout === "collapsed", DEFAULT_NODE_HEIGHT);

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        layout === "collapsed" && "h-auto"
      )}
      style={layout === "default" ? { maxHeight: MAX_NODE_HEIGHT } : undefined}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <NodeResizer
        isVisible={selected && layout === "default"}
        minWidth={MIN_NODE_WIDTH}
        minHeight={MIN_NODE_HEIGHT}
        maxWidth={MAX_NODE_WIDTH}
        maxHeight={MAX_NODE_HEIGHT}
        onResize={() => setManuallyResized(id)}
        handleClassName="!size-2.5 !rounded-full !border !border-border !bg-background"
        lineClassName="!border-foreground/20"
      />
      <Handle type="target" position={Position.Left} className="!bg-foreground/40" />
      <Handle type="source" position={Position.Right} className="!bg-foreground/40" />

      <NodeHeader block={block} ctx={ctx} />
      {layout === "default" && (
        <NodeBody block={block} ctx={ctx} autoFocusInput={block.messages.length === 0} />
      )}
      <NodeFullscreen block={block} ctx={ctx} />
    </div>
  );
});
