"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { DrawRegularPolygonOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { makeShape, regularPolygonPoints } from "@/components/engine/geometry";

/** A regular n-gon (pentagon, hexagon, heptagon, octagon, ...) computed from center+radius —
 * shares PolygonOp's edge-by-edge reveal so it animates the same way. */
export function RegularPolygonOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawRegularPolygonOp>) {
  const points = useMemo(
    () => regularPolygonPoints(op.center, op.radius, op.sides, op.rotation),
    [op.center, op.radius, op.sides, op.rotation]
  );
  const shape = useMemo(() => (op.filled ? makeShape(points) : null), [op.filled, points]);

  if (progress <= 0) return null;

  const segments = points.length;
  const scaled = progress * segments;
  const fullEdges = Math.min(Math.floor(scaled), segments);
  const partialT = scaled - fullEdges;

  const outline: [number, number, number][] = [];
  for (let i = 0; i <= fullEdges && i < segments; i++) {
    outline.push([points[i][0], points[i][1], 0]);
  }
  if (progress >= 1) {
    outline.push([points[0][0], points[0][1], 0]);
  } else if (fullEdges < segments) {
    const from = points[fullEdges % segments];
    const to = points[(fullEdges + 1) % segments];
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
