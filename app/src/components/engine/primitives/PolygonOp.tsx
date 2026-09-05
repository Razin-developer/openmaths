"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { DrawPolygonOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { makeShape } from "@/components/engine/geometry";

export function PolygonOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawPolygonOp>) {
  const shape = useMemo(() => (op.filled ? makeShape(op.points) : null), [op.filled, op.points]);

  if (progress <= 0) return null;

  const segments = op.points.length;
  const scaled = progress * segments;
  const fullEdges = Math.min(Math.floor(scaled), segments);
  const partialT = scaled - fullEdges;

  const outline: [number, number, number][] = [];
  for (let i = 0; i <= fullEdges && i < segments; i++) {
    outline.push([op.points[i][0], op.points[i][1], 0]);
  }
  if (progress >= 1) {
    outline.push([op.points[0][0], op.points[0][1], 0]);
  } else if (fullEdges < segments) {
    const from = op.points[fullEdges % segments];
    const to = op.points[(fullEdges + 1) % segments];
    outline.push([from[0] + (to[0] - from[0]) * partialT, from[1] + (to[1] - from[1]) * partialT, 0]);
  }

  return (
    <group>
      {shape && progress >= 1 && (
        <mesh position={[0, 0, -0.01]}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color={colors.faintInk} transparent opacity={0.18} />
        </mesh>
      )}
      <Line points={outline} color={hovered ? colors.highlightStroke : colors.ink} lineWidth={hovered ? 3 : 2} />
      {progress >= 1 && (
        <Line
          points={outline}
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
