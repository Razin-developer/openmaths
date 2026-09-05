"use client";

import { Text } from "@react-three/drei";
import type { LabelSideOp as LabelSideOpType } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { midpoint, perpendicularOffset } from "@/components/engine/geometry";
import { useScreenFontSize } from "@/components/engine/useScreenFontSize";
import { formatMathText } from "@/components/engine/mathText";

export function LabelSideOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<LabelSideOpType>) {
  const fontSize = useScreenFontSize(hovered ? 13 : 11);
  if (progress <= 0) return null;

  const mid = midpoint(op.from, op.to);
  const [ox, oy] = perpendicularOffset(op.from, op.to, 0.24);
  const text = [op.meta?.label, op.meta?.value].filter((v) => v !== undefined).join(" = ") || op.meta?.label || "";
  if (!text) return null;

  return (
    <Text
      position={[mid[0] + ox, mid[1] + oy, 0.02]}
      fontSize={fontSize}
      color={hovered ? colors.highlightStroke : colors.mutedInk}
      anchorX="center"
      anchorY="middle"
      fillOpacity={Math.min(progress * 3, 1)}
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
  );
}
