"use client";

import { useMemo } from "react";
import { Line, Text } from "@react-three/drei";
import type { LabelAngleOp as LabelAngleOpType } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { angleBetween, arcPoints } from "@/components/engine/geometry";
import { useScreenFontSize } from "@/components/engine/useScreenFontSize";
import { formatMathText } from "@/components/engine/mathText";

const ARC_RADIUS = 0.4;

export function LabelAngleOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<LabelAngleOpType>) {
  const fontSize = useScreenFontSize(hovered ? 13 : 11);
  const { start, end } = useMemo(() => angleBetween(op.vertex, op.arm1, op.arm2), [op.vertex, op.arm1, op.arm2]);
  const points = useMemo(
    () => arcPoints(op.vertex, ARC_RADIUS, start, end, progress),
    [op.vertex, start, end, progress]
  );

  if (progress <= 0) return null;

  const midAngle = start + (end - start) * 0.5;
  const labelPos: [number, number, number] = [
    op.vertex[0] + Math.cos(midAngle) * (ARC_RADIUS + 0.26),
    op.vertex[1] + Math.sin(midAngle) * (ARC_RADIUS + 0.26),
    0.02,
  ];
  const text = [op.meta?.label, op.meta?.value].filter((v) => v !== undefined).join(" = ") || op.meta?.label || "";

  return (
    <group>
      <Line points={points} color={hovered ? colors.highlightStroke : colors.mutedInk} lineWidth={hovered ? 2.5 : 1.5} />
      {progress >= 1 && text && (
        <Text
          position={labelPos}
          fontSize={fontSize}
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
          {formatMathText(text)}
        </Text>
      )}
    </group>
  );
}
