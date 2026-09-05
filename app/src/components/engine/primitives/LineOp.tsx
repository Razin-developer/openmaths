"use client";

import { Line } from "@react-three/drei";
import type { DrawLineOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";

export function LineOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawLineOp>) {
  if (progress <= 0) return null;

  const start: [number, number, number] = [op.from[0], op.from[1], 0];
  const end: [number, number, number] = [
    op.from[0] + (op.to[0] - op.from[0]) * progress,
    op.from[1] + (op.to[1] - op.from[1]) * progress,
    0,
  ];

  return (
    <group>
      <Line points={[start, end]} color={hovered ? colors.highlightStroke : colors.ink} lineWidth={hovered ? 3 : 2} />
      {progress >= 1 && (
        <Line
          points={[start, end]}
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
