"use client";

import type { DrawPointOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";

const POINT_RADIUS = 0.06;

/** A small filled dot marking a named point — the common "•A" convention. */
export function PointOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawPointOp>) {
  if (progress <= 0) return null;
  const scale = Math.min(progress * 2, 1);

  return (
    <mesh
      position={[op.at[0], op.at[1], 0.02]}
      scale={scale}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHoverChange(op.id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHoverChange(null);
      }}
    >
      <circleGeometry args={[POINT_RADIUS, 24]} />
      <meshBasicMaterial color={hovered ? colors.highlightStroke : colors.ink} />
    </mesh>
  );
}
