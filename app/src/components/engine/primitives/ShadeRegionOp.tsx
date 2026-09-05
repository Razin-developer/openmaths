"use client";

import { useMemo } from "react";
import type { ShadeRegionOp as ShadeRegionOpType } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { makeShape } from "@/components/engine/geometry";

/** A filled, semi-transparent region — "this is the area we're computing", distinct from
 * draw_polygon's opaque outline+fill (which is for solid shapes, not emphasis washes). */
export function ShadeRegionOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<ShadeRegionOpType>) {
  const shape = useMemo(() => makeShape(op.points), [op.points]);
  if (progress <= 0) return null;

  const targetOpacity = op.opacity ?? 0.22;

  return (
    <mesh
      position={[0, 0, -0.015]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHoverChange(op.id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHoverChange(null);
      }}
    >
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial
        color={hovered ? colors.highlightStroke : colors.ink}
        transparent
        opacity={targetOpacity * Math.min(progress * 3, 1)}
      />
    </mesh>
  );
}
