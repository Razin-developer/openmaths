"use client";

import type { DrawOp, Point2, Scene } from "@/lib/dsl/types";
import { midpoint } from "@/components/engine/geometry";
import { projectWorldToScreen } from "@/lib/board/orthoProjection";

export function anchorPointForOp(op: DrawOp): Point2 | null {
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

/**
 * PRD B3's rasterized-preview version of HighlightOverlay.tsx — same lookup/anchor logic, but
 * positioned with plain CSS math (`projectWorldToScreen`) instead of drei's `<Html>`, which needs
 * a live Three.js camera to project through. A raster snapshot has no camera left once its
 * capture canvas is torn down, so this is the only way hover-highlight can keep working on a
 * static preview without holding a persistent WebGL context just for that.
 */
export function StaticHighlightOverlay({
  scene,
  hoveredOpId,
  fit,
  size,
}: {
  scene: Scene;
  hoveredOpId: string | null;
  fit: { cx: number; cy: number; zoom: number };
  size: { width: number; height: number };
}) {
  if (!hoveredOpId) return null;

  const op = scene.ops.find((o) => o.id === hoveredOpId);
  if (!op || !op.meta || (op.meta.label === undefined && op.meta.value === undefined)) return null;

  const anchor = anchorPointForOp(op);
  if (!anchor) return null;

  const { x, y } = projectWorldToScreen(anchor, fit, size);

  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2 py-1 text-[11px] whitespace-nowrap text-popover-foreground shadow-sm"
      style={{ left: x, top: y - 12 }}
    >
      {op.meta.label}
      {op.meta.value !== undefined ? ` = ${op.meta.value}` : ""}
    </div>
  );
}
