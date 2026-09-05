"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { DrawParallelMarksOp, DrawRightAngleMarkOp, DrawTickMarksOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { midpoint, perpendicularOffset } from "@/components/engine/geometry";

const TICK_LENGTH = 0.14;
const TICK_GAP = 0.09;

/** 1-3 short perpendicular ticks across a segment's midpoint — "these sides are equal" when the
 * same count appears on multiple sides. */
export function TickMarksOp({ op, progress, hovered, colors }: OpPrimitiveProps<DrawTickMarksOp>) {
  const count = Math.min(Math.max(op.count ?? 1, 1), 3);
  const segments = useMemo(() => {
    const mid = midpoint(op.from, op.to);
    const dx = op.to[0] - op.from[0];
    const dy = op.to[1] - op.from[1];
    const len = Math.hypot(dx, dy) || 1;
    const along: [number, number] = [dx / len, dy / len];
    const perp = perpendicularOffset(op.from, op.to, TICK_LENGTH / 2);
    const offsets = count === 1 ? [0] : count === 2 ? [-TICK_GAP / 2, TICK_GAP / 2] : [-TICK_GAP, 0, TICK_GAP];
    return offsets.map((o): [[number, number, number], [number, number, number]] => {
      const cx = mid[0] + along[0] * o;
      const cy = mid[1] + along[1] * o;
      return [
        [cx + perp[0], cy + perp[1], 0],
        [cx - perp[0], cy - perp[1], 0],
      ];
    });
  }, [op.from, op.to, count]);

  if (progress <= 0) return null;
  const color = hovered ? colors.highlightStroke : colors.mutedInk;

  return (
    <group>
      {segments.map((pts, i) => (
        <Line key={i} points={pts} color={color} lineWidth={2} />
      ))}
    </group>
  );
}

/** A small square at a vertex between two arms — marks a right angle. */
export function RightAngleMarkOp({ op, progress, hovered, colors }: OpPrimitiveProps<DrawRightAngleMarkOp>) {
  const size = op.size ?? 0.22;
  const points = useMemo(() => {
    const [vx, vy] = op.vertex;
    const d1x = op.arm1[0] - vx;
    const d1y = op.arm1[1] - vy;
    const l1 = Math.hypot(d1x, d1y) || 1;
    const d2x = op.arm2[0] - vx;
    const d2y = op.arm2[1] - vy;
    const l2 = Math.hypot(d2x, d2y) || 1;
    const p1: [number, number] = [vx + (d1x / l1) * size, vy + (d1y / l1) * size];
    const p2: [number, number] = [vx + (d2x / l2) * size, vy + (d2y / l2) * size];
    const corner: [number, number] = [p1[0] + p2[0] - vx, p1[1] + p2[1] - vy];
    return [p1, corner, p2].map((p): [number, number, number] => [p[0], p[1], 0]);
  }, [op.vertex, op.arm1, op.arm2, size]);

  if (progress <= 0) return null;
  return <Line points={points} color={hovered ? colors.highlightStroke : colors.mutedInk} lineWidth={1.5} />;
}

/** 1-2 chevron ("arrow") ticks along a segment — matching counts on different lines mean "these
 * are parallel". */
export function ParallelMarksOp({ op, progress, hovered, colors }: OpPrimitiveProps<DrawParallelMarksOp>) {
  const count = Math.min(Math.max(op.count ?? 1, 1), 2);
  const chevrons = useMemo(() => {
    const mid = midpoint(op.from, op.to);
    const dx = op.to[0] - op.from[0];
    const dy = op.to[1] - op.from[1];
    const len = Math.hypot(dx, dy) || 1;
    const along: [number, number] = [dx / len, dy / len];
    const perp: [number, number] = [-along[1] * 0.08, along[0] * 0.08];
    const offsets = count === 1 ? [0] : [-TICK_GAP, TICK_GAP];
    return offsets.map((o) => {
      const cx = mid[0] + along[0] * o;
      const cy = mid[1] + along[1] * o;
      const back: [number, number] = [cx - along[0] * 0.08, cy - along[1] * 0.08];
      const tip: [number, number] = [cx + along[0] * 0.08, cy + along[1] * 0.08];
      return [
        [back[0] + perp[0], back[1] + perp[1], 0],
        [tip[0], tip[1], 0],
        [back[0] - perp[0], back[1] - perp[1], 0],
      ] as [number, number, number][];
    });
  }, [op.from, op.to, count]);

  if (progress <= 0) return null;
  const color = hovered ? colors.highlightStroke : colors.mutedInk;

  return (
    <group>
      {chevrons.map((pts, i) => (
        <Line key={i} points={pts} color={color} lineWidth={2} />
      ))}
    </group>
  );
}
