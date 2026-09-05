"use client";

import { Text } from "@react-three/drei";
import type { PlaceTextOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { useScreenFontSize } from "@/components/engine/useScreenFontSize";
import { formatMathText } from "@/components/engine/mathText";

const SIZE_MAP_PX: Record<NonNullable<PlaceTextOp["size"]>, number> = {
  sm: 12,
  md: 15,
  lg: 19,
};

/** Renders `place_text` ops — visible text drawn directly on the diagram (e.g. "3x + 7 = 22"). */
export function NoteOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<PlaceTextOp>) {
  const fontSize = useScreenFontSize(SIZE_MAP_PX[op.size ?? "md"]);
  if (progress <= 0) return null;

  return (
    <Text
      position={[op.at[0], op.at[1], 0.02]}
      fontSize={fontSize}
      color={hovered ? colors.highlightStroke : colors.ink}
      anchorX="left"
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
      {formatMathText(op.text)}
    </Text>
  );
}
