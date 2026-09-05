"use client";

import { Line } from "@react-three/drei";
import type { DrawDashedLineOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";

/** A dashed segment — used for auxiliary/construction lines, extensions, hidden edges. */
export function DashedLineOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawDashedLineOp>) {
  if (progress <= 0) return null;

  const tip: [number, number] = [
    op.from[0] + (op.to[0] - op.from[0]) * progress,
    op.from[1] + (op.to[1] - op.from[1]) * progress,
  ];

  return (
    <group>
      <Line
        points={[[op.from[0], op.from[1], 0], [tip[0], tip[1], 0]]}
        color={hovered ? colors.highlightStroke : colors.mutedInk}
        lineWidth={hovered ? 2.5 : 1.5}
        dashed
        dashSize={0.12}
        gapSize={0.08}
      />
      {progress >= 1 && (
        <Line
          points={[[op.from[0], op.from[1], 0], [op.to[0], op.to[1], 0]]}
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
