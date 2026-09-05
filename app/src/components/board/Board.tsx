"use client";

import { useCallback, useMemo, useState } from "react";
import { ReactFlowProvider, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { CanvasData, BlockData, ConnectionData } from "@/lib/board/types";
import type { CanvasRole } from "@/lib/canvasAccess";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import { Dock } from "@/components/board/Dock";
import { BoardContextProvider } from "@/components/board/boardContext";
import { CanvasContextMenu } from "@/components/board/CanvasContextMenu";
import { CanvasTopBar } from "@/components/board/CanvasTopBar";

export type QuestionNodeData = { block: BlockData };
export type QuestionFlowNode = Node<QuestionNodeData, "questionBlock" | "graphBlock" | "noteBlock" | "linkBlock">;

export interface BoardContext {
  canvasId: string;
  /** This viewer's access role — drives client-side read-only reflection (PRD "Sharing,
   * Collaboration & Access Roles" §7). The server is still the enforced source of truth on every
   * mutation route; this only hides/disables affordances so a Viewer/Commenter isn't shown
   * controls that would just 403. */
  role: CanvasRole;
  canEdit: boolean;
  updateBlock: (blockId: string, patch: Partial<BlockData>) => void;
  addNode: (block: BlockData) => void;
  upsertNode: (block: BlockData, connection?: ConnectionData | null) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;
  removeNode: (blockId: string) => void;
  getConnectedGraphBlock: (blockId: string) => BlockData | null;
  getConnectedGraphBlocks: (blockId: string) => BlockData[];
  /** Every block directly connected FROM this one, any kind — used for @ mention autocomplete
   * (Graph, Note, Link nodes all reachable, not just diagrams). */
  getConnectedBlocks: (blockId: string) => BlockData[];
}

export const DEFAULT_NODE_WIDTH = 320;
export const DEFAULT_NODE_HEIGHT = 420;
export const MIN_NODE_WIDTH = 320;
export const MIN_NODE_HEIGHT = 250;
export const MAX_NODE_WIDTH = 640;
export const MAX_NODE_HEIGHT = 560;

// A browser node's content (tab cards/rows) is naturally compact — a handful of pages never
// come close to filling the same 320x420 default every other node type uses to accommodate
// growing chat/diagram/note content, so it gets its own smaller starting AND minimum size
// instead of a mostly-empty box. Still freely resizable via the same NodeResizer as every other
// node, just with a lower floor.
export const LINK_NODE_WIDTH = 240;
export const LINK_NODE_HEIGHT = 180;
export const MIN_LINK_NODE_WIDTH = 200;
export const MIN_LINK_NODE_HEIGHT = 140;

// Same idea for a question/note that's still genuinely empty (no messages sent yet / no text
// written yet) — a blank prompt box or "click to start writing" hint doesn't need the same
// 420px a real conversation or note eventually grows into. Only applies at creation/load time
// while there's nothing in it yet; once it has content the normal default takes over and stays
// (this app's fixed-height-until-manually-resized model already works this way for every node).
export const EMPTY_NODE_HEIGHT = 210;

const NODE_TYPE_BY_KIND: Record<BlockData["kind"], QuestionFlowNode["type"]> = {
  QUESTION: "questionBlock",
  SUB_QUESTION: "questionBlock",
  GRAPH: "graphBlock",
  NOTE: "noteBlock",
  LINK: "linkBlock",
};

function isEmptyBlock(block: BlockData): boolean {
  if (block.kind === "QUESTION" || block.kind === "SUB_QUESTION") return block.messages.length === 0;
  if (block.kind === "NOTE") return !block.prompt.trim();
  return false;
}

function blockToNode(block: BlockData): QuestionFlowNode {
  const compact = block.kind === "LINK" || isEmptyBlock(block);
  return {
    id: block.id,
    type: NODE_TYPE_BY_KIND[block.kind],
    position: { x: block.positionX, y: block.positionY },
    data: { block },
    draggable: true,
    dragHandle: ".drag-handle",
    width: block.kind === "LINK" ? LINK_NODE_WIDTH : DEFAULT_NODE_WIDTH,
    // A real (not just "initial") height. React Flow only lets a node grow to fit its content
    // once its own internal auto-measurement completes, and that measurement has proven
    // unreliable for nodes whose content changes after mount (streamed text, a diagram loading,
    // a link preview arriving) — it can get permanently stuck at whatever estimate it started
    // with, only recovering once something else forces a remeasure (e.g. a manual resize). A
    // fixed, always-authoritative height sidesteps that entirely: every node starts at a
    // consistent, usable size with a working internal scroll area from the first render, and
    // NodeResizer (already wired on every node type) still lets the user resize by hand exactly
    // like today — dragging a resize handle updates this same `height` field via onNodesChange.
    // A still-empty question/note starts at the smaller EMPTY_NODE_HEIGHT instead, since there's
    // nothing yet to need the full default — this is only evaluated once, at node creation/load,
    // same as every other node's fixed-height model.
    height: block.kind === "LINK" ? LINK_NODE_HEIGHT : compact ? EMPTY_NODE_HEIGHT : DEFAULT_NODE_HEIGHT,
  };
}

function connectionsToEdges(canvas: CanvasData): Edge[] {
  return canvas.connections.map((c) => ({
    id: c.id,
    source: c.sourceBlockId,
    target: c.targetBlockId,
    label: c.label ?? undefined,
  }));
}

export function Board({ initialCanvas, role }: { initialCanvas: CanvasData; role: CanvasRole }) {
  const [canvasId] = useState(initialCanvas.id);
  const canEdit = role === "owner" || role === "editor";
  const [nodes, setNodes] = useState<QuestionFlowNode[]>(() => initialCanvas.blocks.map(blockToNode));
  const [edges, setEdges] = useState<Edge[]>(() => connectionsToEdges(initialCanvas));

  const updateBlock = useCallback((blockId: string, patch: Partial<BlockData>) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === blockId ? { ...node, data: { block: { ...node.data.block, ...patch } } } : node
      )
    );
  }, []);

  const addNode = useCallback((block: BlockData) => {
    setNodes((prev) => [...prev, blockToNode(block)]);
  }, []);

  const addEdge = useCallback((edge: Edge) => {
    setEdges((prev) => (prev.some((e) => e.id === edge.id) ? prev : [...prev, edge]));
  }, []);

  const upsertNode = useCallback(
    (block: BlockData, connection?: ConnectionData | null) => {
      setNodes((prev) => {
        const exists = prev.some((n) => n.id === block.id);
        if (exists) {
          return prev.map((n) => (n.id === block.id ? { ...n, data: { block } } : n));
        }
        return [...prev, blockToNode(block)];
      });
      if (connection) {
        setEdges((prev) =>
          prev.some((e) => e.id === connection.id)
            ? prev
            : [...prev, { id: connection.id, source: connection.sourceBlockId, target: connection.targetBlockId }]
        );
      }
    },
    []
  );

  const removeEdge = useCallback((edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  }, []);

  const removeNode = useCallback((blockId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== blockId));
    setEdges((prev) => prev.filter((e) => e.source !== blockId && e.target !== blockId));
  }, []);

  const getConnectedGraphBlock = useCallback(
    (blockId: string): BlockData | null => {
      const edge = edges.find((e) => e.source === blockId);
      if (!edge) return null;
      const node = nodes.find((n) => n.id === edge.target && n.data.block.kind === "GRAPH");
      return node?.data.block ?? null;
    },
    [edges, nodes]
  );

  const getConnectedGraphBlocks = useCallback(
    (blockId: string): BlockData[] => {
      return edges
        .filter((e) => e.source === blockId)
        .map((e) => nodes.find((n) => n.id === e.target && n.data.block.kind === "GRAPH")?.data.block)
        .filter((b): b is BlockData => b !== undefined);
    },
    [edges, nodes]
  );

  const getConnectedBlocks = useCallback(
    (blockId: string): BlockData[] => {
      // Both directions — a Note/Link/Graph node connected INTO this one (this node is the
      // edge's target) is just as mentionable as one this node points OUT to (this node is the
      // edge's source); a connection line means "related", regardless of which end started it.
      const seen = new Set<string>();
      const blocks: BlockData[] = [];
      for (const e of edges) {
        let otherId: string | null = null;
        if (e.source === blockId) otherId = e.target;
        else if (e.target === blockId) otherId = e.source;
        if (!otherId || seen.has(otherId)) continue;
        const block = nodes.find((n) => n.id === otherId)?.data.block;
        if (block) {
          seen.add(otherId);
          blocks.push(block);
        }
      }
      return blocks;
    },
    [edges, nodes]
  );

  const ctx: BoardContext = useMemo(
    () => ({
      canvasId,
      role,
      canEdit,
      updateBlock,
      addNode,
      upsertNode,
      addEdge,
      removeEdge,
      removeNode,
      getConnectedGraphBlock,
      getConnectedGraphBlocks,
      getConnectedBlocks,
    }),
    [
      canvasId,
      role,
      canEdit,
      updateBlock,
      addNode,
      upsertNode,
      addEdge,
      removeEdge,
      removeNode,
      getConnectedGraphBlock,
      getConnectedGraphBlocks,
      getConnectedBlocks,
    ]
  );

  return (
    <ReactFlowProvider>
      <BoardContextProvider value={ctx}>
        <div className="relative h-full w-full">
          <CanvasContextMenu ctx={ctx}>
            <BoardCanvas nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges} ctx={ctx} />
          </CanvasContextMenu>
          <CanvasTopBar canvasId={canvasId} initialTitle={initialCanvas.title} role={role} />
          {canEdit && <Dock ctx={ctx} />}
        </div>
      </BoardContextProvider>
    </ReactFlowProvider>
  );
}
