"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { api } from "@openmaths/api-client";

export function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, selected }: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // PRD "Split into app + server" P3-continued round 3 — cut over to the base-URL client.
  async function handleDelete() {
    setEdges((edges) => edges.filter((e) => e.id !== id));
    await api.connections.remove(id).catch(() => {});
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute transition-opacity"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            opacity: selected ? 1 : 0,
          }}
        >
          <button
            onClick={handleDelete}
            className="flex size-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            aria-label="Delete connection"
          >
            <X className="size-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
