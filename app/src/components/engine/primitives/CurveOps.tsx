"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { DrawBezierOp, DrawFunctionOp, DrawParabolaOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { bezierPoints } from "@/components/engine/geometry";
import { evaluateExpr } from "@/lib/dsl/expr";

function sampledLine(
  points: [number, number, number][],
  progress: number,
  hovered: boolean,
  onHoverChange: (opId: string | null) => void,
  opId: string,
  color: string
) {
  if (points.length === 0) return null;
  const revealed = Math.max(2, Math.round(points.length * Math.max(progress, 0.02)));
  const shown = points.slice(0, revealed);

  return (
    <group>
      <Line points={shown} color={color} lineWidth={hovered ? 3 : 2} />
      {progress >= 1 && (
        <Line
          points={points}
          lineWidth={18}
          transparent
          opacity={0}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHoverChange(opId);
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

export function ParabolaOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawParabolaOp>) {
  const points = useMemo(() => {
    const [x0, x1] = op.xRange;
    const samples = 40;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= samples; i++) {
      const x = x0 + ((x1 - x0) * i) / samples;
      const y = op.coefficient * (x - op.vertex[0]) * (x - op.vertex[0]) + op.vertex[1];
      pts.push([x, y, 0]);
    }
    return pts;
  }, [op.xRange, op.coefficient, op.vertex]);

  if (progress <= 0) return null;
  return sampledLine(points, progress, hovered, onHoverChange, op.id, hovered ? colors.highlightStroke : colors.ink);
}

export function FunctionPlotOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawFunctionOp>) {
  const points = useMemo(() => {
    const [x0, x1] = op.xRange;
    const samples = op.samples ?? 60;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= samples; i++) {
      const x = x0 + ((x1 - x0) * i) / samples;
      try {
        const y = evaluateExpr(op.expr, { x });
        if (Number.isFinite(y)) pts.push([x, y, 0]);
      } catch {
        // skip unevaluable points rather than breaking the whole curve
      }
    }
    return pts;
  }, [op.xRange, op.samples, op.expr]);

  if (progress <= 0) return null;
  return sampledLine(points, progress, hovered, onHoverChange, op.id, hovered ? colors.highlightStroke : colors.ink);
}

export function BezierOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawBezierOp>) {
  const points = useMemo(
    () => bezierPoints(op.from, op.control1, op.control2, op.to, 1),
    [op.from, op.control1, op.control2, op.to]
  );

  if (progress <= 0) return null;
  return sampledLine(points, progress, hovered, onHoverChange, op.id, hovered ? colors.highlightStroke : colors.ink);
}
