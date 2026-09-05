"use client";

import { Html } from "@react-three/drei";
import type { DrawOp, Point2, Scene } from "@/lib/dsl/types";
import { midpoint } from "@/components/engine/geometry";

function anchorPointForOp(op: DrawOp): Point2 | null {
  switch (op.op) {
    case "draw_line":
    case "label_side":
      return midpoint(op.from, op.to);
    case "draw_polygon":
      return op.points[0];
    case "draw_circle":
    case "draw_arc":
      return op.center;
    case "label_angle":
      return op.vertex;
    case "place_text":
      return op.at;
    default:
      return null;
  }
}

export function HighlightOverlay({ scene, hoveredOpId }: { scene: Scene; hoveredOpId: string | null }) {
  if (!hoveredOpId) return null;

  const op = scene.ops.find((o) => o.id === hoveredOpId);
  if (!op || !op.meta || (op.meta.label === undefined && op.meta.value === undefined)) return null;

  const anchor = anchorPointForOp(op);
  if (!anchor) return null;

  return (
    <Html position={[anchor[0], anchor[1], 0.1]} center distanceFactor={8} zIndexRange={[50, 0]}>
      <div className="pointer-events-none -translate-y-6 rounded-md border border-border bg-popover px-2 py-1 text-[11px] whitespace-nowrap text-popover-foreground shadow-sm">
        {op.meta.label}
        {op.meta.value !== undefined ? ` = ${op.meta.value}` : ""}
      </div>
    </Html>
  );
}
