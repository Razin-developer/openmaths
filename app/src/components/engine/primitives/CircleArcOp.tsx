"use client";

import { useMemo } from "react";
import { Line, Text } from "@react-three/drei";
import type { DrawArcOp, DrawCircleOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { arcPoints } from "@/components/engine/geometry";

export function CircleArcOp({
  op,
  progress,
  hovered,
  onHoverChange,
  colors,
}: OpPrimitiveProps<DrawCircleOp | DrawArcOp>) {
  const [startAngle, endAngle] = op.op === "draw_circle" ? [0, Math.PI * 2] : [op.startAngle, op.endAngle];
  const points = useMemo(
    () => arcPoints(op.center, op.radius, startAngle, endAngle, progress),
    [op.center, op.radius, startAngle, endAngle, progress]
  );

  if (progress <= 0) return null;

  const midAngle = startAngle + (endAngle - startAngle) * 0.5;
  const labelRadius = op.radius + 0.28;
  const labelPos: [number, number, number] = [
    op.center[0] + Math.cos(midAngle) * labelRadius,
    op.center[1] + Math.sin(midAngle) * labelRadius,
    0.02,
  ];
  const text = [op.meta?.label, op.meta?.value].filter((v) => v !== undefined).join(" = ");

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
      {progress >= 1 && text && (
        <Text
          position={labelPos}
          fontSize={hovered ? 0.19 : 0.16}
          color={hovered ? colors.highlightStroke : colors.mutedInk}
          anchorX="center"
          anchorY="middle"
          onPointerOver={(e) => {
            e.stopPropagation();
            onHoverChange(op.id);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onHoverChange(null);
          }}
        >
          {text}
        </Text>
      )}
    </group>
  );
}
