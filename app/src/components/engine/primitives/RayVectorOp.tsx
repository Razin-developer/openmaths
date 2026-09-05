"use client";

import { Line } from "@react-three/drei";
import type { DrawRayOp, DrawVectorOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { arrowHeadPoints, makeShape } from "@/components/engine/geometry";

const RAY_EXTENSION = 1.5;

/** draw_ray extends past `to` (a semi-infinite ray); draw_vector stops exactly at `to`. Both end
 * in a filled arrowhead. */
export function RayVectorOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawRayOp | DrawVectorOp>) {
  if (progress <= 0) return null;

  const dx = op.to[0] - op.from[0];
  const dy = op.to[1] - op.from[1];
  const len = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dy, dx);

  const finalTip: [number, number] =
    op.op === "draw_ray" ? [op.to[0] + (dx / len) * RAY_EXTENSION, op.to[1] + (dy / len) * RAY_EXTENSION] : op.to;

  const tip: [number, number] = [
    op.from[0] + (finalTip[0] - op.from[0]) * progress,
    op.from[1] + (finalTip[1] - op.from[1]) * progress,
  ];

  const color = hovered ? colors.highlightStroke : colors.ink;
  const arrow = progress >= 1 ? makeShape(arrowHeadPoints(finalTip, angle)) : null;

  return (
    <group>
      <Line points={[[op.from[0], op.from[1], 0], [tip[0], tip[1], 0]]} color={color} lineWidth={hovered ? 3 : 2} />
      {arrow && (
        <mesh position={[0, 0, 0.01]}>
          <shapeGeometry args={[arrow]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {progress >= 1 && (
        <Line
          points={[[op.from[0], op.from[1], 0], [finalTip[0], finalTip[1], 0]]}
          lineWidth={18}
          transparent
          opacity={0}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHoverChange(op.id);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onHoverChange(null);
          }}
        />
      )}
    </group>
  );
}
