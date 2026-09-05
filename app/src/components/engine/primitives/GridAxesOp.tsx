"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { DrawAxesOp, DrawGridOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { arrowHeadPoints, makeShape } from "@/components/engine/geometry";

/** Light background grid lines — decoration, not hover-highlightable (no meaningful "geometry" to
 * click on), appears fully at once rather than progressively drawing. */
export function GridOp({ op, progress, colors }: OpPrimitiveProps<DrawGridOp>) {
  const lines = useMemo(() => {
    const { minX, minY, maxX, maxY } = op.boundingBox;
    const result: [number, number, number][][] = [];
    for (let x = Math.ceil(minX / op.spacing) * op.spacing; x <= maxX; x += op.spacing) {
      result.push([
        [x, minY, -0.02],
        [x, maxY, -0.02],
      ]);
    }
    for (let y = Math.ceil(minY / op.spacing) * op.spacing; y <= maxY; y += op.spacing) {
      result.push([
        [minX, y, -0.02],
        [maxX, y, -0.02],
      ]);
    }
    return result;
  }, [op.boundingBox, op.spacing]);

  if (progress <= 0) return null;

  return (
    <group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={colors.faintInk} lineWidth={1} transparent opacity={0.5} />
      ))}
    </group>
  );
}

/** Coordinate axes with arrowheads at the positive ends. */
export function AxesOp({ op, progress, colors }: OpPrimitiveProps<DrawAxesOp>) {
  if (progress <= 0) return null;

  const xTip: [number, number] = [op.origin[0] + op.xLength, op.origin[1]];
  const yTip: [number, number] = [op.origin[0], op.origin[1] + op.yLength];
  const xArrow = makeShape(arrowHeadPoints(xTip, 0));
  const yArrow = makeShape(arrowHeadPoints(yTip, Math.PI / 2));

  return (
    <group>
      <Line points={[[op.origin[0] - 0.3, op.origin[1], 0], [xTip[0], xTip[1], 0]]} color={colors.mutedInk} lineWidth={1.5} />
      <Line points={[[op.origin[0], op.origin[1] - 0.3, 0], [yTip[0], yTip[1], 0]]} color={colors.mutedInk} lineWidth={1.5} />
      <mesh position={[0, 0, 0]}>
        <shapeGeometry args={[xArrow]} />
        <meshBasicMaterial color={colors.mutedInk} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <shapeGeometry args={[yArrow]} />
        <meshBasicMaterial color={colors.mutedInk} />
      </mesh>
    </group>
  );
}
