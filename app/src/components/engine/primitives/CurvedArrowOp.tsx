"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { DrawCurvedArrowOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { arcPoints, arrowHeadPoints, makeShape } from "@/components/engine/geometry";

/** An arc ending in an arrowhead — indicates rotation/transformation direction. */
export function CurvedArrowOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawCurvedArrowOp>) {
  const points = useMemo(
    () => arcPoints(op.center, op.radius, op.startAngle, op.endAngle, progress),
    [op.center, op.radius, op.startAngle, op.endAngle, progress]
  );

  if (progress <= 0 || points.length < 2) return null;
  const color = hovered ? colors.highlightStroke : colors.ink;

  const tip = points[points.length - 1];
  const prev = points[points.length - 2];
  const tangentAngle = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
  const arrow = progress >= 1 ? makeShape(arrowHeadPoints([tip[0], tip[1]], tangentAngle, 0.13)) : null;

  return (
    <group>
      <Line points={points} color={color} lineWidth={hovered ? 3 : 2} />
      {arrow && (
        <mesh position={[0, 0, 0.01]}>
          <shapeGeometry args={[arrow]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {progress >= 1 && (
        <Line
          points={points}
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
