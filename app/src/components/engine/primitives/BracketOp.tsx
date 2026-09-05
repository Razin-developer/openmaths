"use client";

import { useMemo } from "react";
import { Line, Text } from "@react-three/drei";
import type { DrawBracketOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { perpendicularOffset } from "@/components/engine/geometry";
import { useScreenFontSize } from "@/components/engine/useScreenFontSize";
import { formatMathText } from "@/components/engine/mathText";

const BRACKET_DEPTH = 0.18;

/** A brace-like bracket alongside a segment/region, for labeling a span — e.g. "{ 5 cm }". */
export function BracketOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawBracketOp>) {
  const fontSize = useScreenFontSize(11);
  const points = useMemo(() => {
    const [ox, oy] = perpendicularOffset(op.from, op.to, BRACKET_DEPTH);
    const p1: [number, number] = [op.from[0] + ox, op.from[1] + oy];
    const mid: [number, number] = [(op.from[0] + op.to[0]) / 2 + ox * 1.4, (op.from[1] + op.to[1]) / 2 + oy * 1.4];
    const p2: [number, number] = [op.to[0] + ox, op.to[1] + oy];
    return [
      [op.from[0], op.from[1], 0],
      [p1[0], p1[1], 0],
      [mid[0], mid[1], 0],
      [p2[0], p2[1], 0],
      [op.to[0], op.to[1], 0],
    ] as [number, number, number][];
  }, [op.from, op.to]);

  if (progress <= 0) return null;
  const color = hovered ? colors.highlightStroke : colors.mutedInk;
  const [ox, oy] = perpendicularOffset(op.from, op.to, BRACKET_DEPTH * 2.4);
  const labelPos: [number, number, number] = [
    (op.from[0] + op.to[0]) / 2 + ox,
    (op.from[1] + op.to[1]) / 2 + oy,
    0.02,
  ];

  return (
    <group>
      <Line
        points={points}
        color={color}
        lineWidth={1.5}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverChange(op.id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHoverChange(null);
        }}
      />
      {op.label && (
        <Text position={labelPos} fontSize={fontSize} color={color} anchorX="center" anchorY="middle">
          {formatMathText(op.label)}
        </Text>
      )}
    </group>
  );
}
