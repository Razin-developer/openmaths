"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Edge,
  type OnConnectStart,
  type OnConnectEnd,
} from "@xyflow/react";
import { toast } from "sonner";
import { api, ApiError } from "@openmaths/api-client";
import type { BoardContext, QuestionFlowNode } from "@/components/board/Board";
import { QuestionNode } from "@/components/board/nodeTypes/QuestionNode";
import { GraphNode } from "@/components/board/nodeTypes/GraphNode";
import { NoteNode } from "@/components/board/nodeTypes/NoteNode";
import { WebLinkNode } from "@/components/board/nodeTypes/WebLinkNode";
import { useBoardUiStore } from "@/store/boardUiStore";
import { BoardEmptyState } from "@/components/board/BoardEmptyState";
import { apiBlockToBlockData } from "@/components/board/apiMappers";
import { DeletableEdge } from "@/components/board/DeletableEdge";
import type { ConnectionData } from "@/lib/board/types";

const nodeTypes = {
  questionBlock: QuestionNode,
  graphBlock: GraphNode,
  noteBlock: NoteNode,
  linkBlock: WebLinkNode,
};

const edgeTypes = { default: DeletableEdge };

// Hoisted (PRD "Performance Audit & Answer-Rendering Fix" B2) — a fresh `{hideAttribution:true}`
// object every render defeats React Flow's own internal memoization, which compares this prop by
// reference.
const proOptions = { hideAttribution: true };

export function BoardCanvas({
  nodes,
  edges,
  setNodes,
  setEdges,
  ctx,
}: {
  nodes: QuestionFlowNode[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<QuestionFlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  ctx: BoardContext;
}) {
  const activeTool = useBoardUiStore((s) => s.activeTool);
  const { screenToFlowPosition } = useReactFlow();
  const connectingNodeId = useRef<string | null>(null);
  const connectSucceeded = useRef(false);
  const [dropHint, setDropHint] = useState<{ x: number; y: number; overNode: boolean } | null>(null);

  // PRD "Split into app + server" P3-continued round 3 — cut over to the base-URL client.
  const createConnection = useCallback(
    async (sourceId: string, targetId: string) => {
      try {
        const { connection } = await api.connections.create({ canvasId: ctx.canvasId, sourceBlockId: sourceId, targetBlockId: targetId });
        const created = connection as { id: string; sourceBlockId: string; targetBlockId: string };
        ctx.addEdge({ id: created.id, source: created.sourceBlockId, target: created.targetBlockId });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Couldn't connect those nodes");
      }
    },
    [ctx]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<QuestionFlowNode>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onNodeDragStop = useCallback((_event: unknown, node: QuestionFlowNode) => {
    api.blocks.update(node.id, { positionX: node.position.x, positionY: node.position.y }).catch(() => {});
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      connectSucceeded.current = true;
      if (!connection.source || !connection.target) return;
      createConnection(connection.source, connection.target);
    },
    [createConnection]
  );

  const onConnectStart = useCallback<OnConnectStart>((_event, { nodeId }) => {
    connectingNodeId.current = nodeId;
    connectSucceeded.current = false;
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!connectingNodeId.current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const overNode = !!target?.closest(".react-flow__node");
    setDropHint({ x: event.clientX, y: event.clientY, overNode });
  }, []);

  const onConnectEnd = useCallback<OnConnectEnd>(
    async (event) => {
      const sourceId = connectingNodeId.current;
      const alreadyConnected = connectSucceeded.current;
      connectingNodeId.current = null;
      connectSucceeded.current = false;
      setDropHint(null);
      if (!sourceId || alreadyConnected) return;

      const target = event.target as Element | null;
      const targetNodeEl = target?.closest(".react-flow__node") as HTMLElement | null | undefined;

      // Dropped anywhere on another node's card (the "hotzone"), not just its tiny handle dot.
      if (targetNodeEl) {
        const targetId = targetNodeEl.dataset.id;
        if (targetId && targetId !== sourceId) {
          await createConnection(sourceId, targetId);
        }
        return;
      }

      // Dropped on blank canvas — spin up a new connected question node right there.
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      const position = screenToFlowPosition({ x: point.clientX, y: point.clientY });

      try {
        const { block, connection } = await api.blocks.create({
          canvasId: ctx.canvasId,
          parentBlockId: sourceId,
          positionX: position.x,
          positionY: position.y,
        });
        ctx.upsertNode(apiBlockToBlockData(block as Record<string, unknown>), (connection as ConnectionData | null) ?? null);
      } catch {
        toast.error("Couldn't create a connected question");
      }
    },
    [ctx, createConnection, screenToFlowPosition]
  );

  return (
    <>
      <div className="h-full w-full" onPointerMove={handlePointerMove}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          panOnDrag={activeTool === "pan"}
          selectionOnDrag={activeTool === "select"}
          deleteKeyCode={null}
          fitView
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={proOptions}
          // PRD B2 — every node (each GRAPH node mounting a full three.js WebGL context, each
          // QUESTION node running ReactMarkdown+KaTeX) was mounting regardless of viewport
          // visibility. React Flow's own built-in culling unmounts off-screen nodes.
          onlyRenderVisibleElements
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1.6} color="var(--canvas-dot)" />
        </ReactFlow>
      </div>
      {nodes.length === 0 && <BoardEmptyState ctx={ctx} />}
      {dropHint &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-primary-foreground shadow-md"
            style={{ left: dropHint.x, top: dropHint.y }}
          >
            {dropHint.overNode ? "Drop to connect" : "Drop to create a question"}
          </div>,
          document.body
        )}
    </>
  );
}
