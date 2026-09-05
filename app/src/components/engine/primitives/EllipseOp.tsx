"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { DrawEllipseOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { ellipsePoints } from "@/components/engine/geometry";

export function EllipseOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawEllipseOp>) {
  const points = useMemo(
    () => ellipsePoints(op.center, op.radiusX, op.radiusY, progress, op.rotation ?? 0),
    [op.center, op.radiusX, op.radiusY, progress, op.rotation]
  );

  if (progress <= 0) return null;

  return (
    <group>
      <Line points={points} color={hovered ? colors.highlightStroke : colors.ink} lineWidth={hovered ? 3 : 2} />
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
