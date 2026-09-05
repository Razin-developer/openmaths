"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { DrawConeOp, DrawCuboidOp, DrawCylinderOp, DrawSphereOutlineOp } from "@/lib/dsl/types";
import type { OpPrimitiveProps } from "@/components/engine/primitives/types";
import { arcPoints, ellipsePoints } from "@/components/engine/geometry";

/** Pseudo-3D solids drawn with plain 2D lines/ellipses in an isometric-ish projection — not a
 * real 3D camera, just the textbook-sketch convention (front face + offset back face, hidden
 * edges dashed) that reads as "3D" without needing a perspective rendering pipeline. */

const ISO_DX = 0.55;
const ISO_DY = 0.32;

function seg(a: [number, number], b: [number, number]): [number, number, number][] {
  return [
    [a[0], a[1], 0],
    [b[0], b[1], 0],
  ];
}

export function CuboidOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawCuboidOp>) {
  const geom = useMemo(() => {
    const [ox, oy] = op.origin;
    // Front face corners (bottom-left, bottom-right, top-right, top-left).
    const f: [number, number][] = [
      [ox, oy],
      [ox + op.width, oy],
      [ox + op.width, oy + op.height],
      [ox, oy + op.height],
    ];
    const shift = (p: [number, number]): [number, number] => [
      p[0] + op.depth * ISO_DX,
      p[1] + op.depth * ISO_DY,
    ];
    const b = f.map(shift) as [number, number][];
    return { f, b };
  }, [op.origin, op.width, op.height, op.depth]);

  if (progress <= 0) return null;
  const color = hovered ? colors.highlightStroke : colors.ink;
  const { f, b } = geom;

  return (
    <group>
      {/* Front face — always fully visible. */}
      <Line points={[...f.map((p) => [p[0], p[1], 0] as [number, number, number]), [f[0][0], f[0][1], 0]]} color={color} lineWidth={hovered ? 3 : 2} />
      {/* Back face top+right edges (visible), bottom+left edges (hidden, dashed). */}
      <Line points={seg(b[0], b[1])} color={colors.mutedInk} lineWidth={1.2} dashed dashSize={0.08} gapSize={0.06} />
      <Line points={seg(b[1], b[2])} color={colors.mutedInk} lineWidth={1.2} dashed dashSize={0.08} gapSize={0.06} />
      <Line points={seg(b[2], b[3])} color={color} lineWidth={hovered ? 3 : 2} />
      <Line points={seg(b[3], b[0])} color={colors.mutedInk} lineWidth={1.2} dashed dashSize={0.08} gapSize={0.06} />
      {/* Connecting edges: front-top-left/right + top corners are visible; front-bottom ones hidden. */}
      <Line points={seg(f[0], b[0])} color={colors.mutedInk} lineWidth={1.2} dashed dashSize={0.08} gapSize={0.06} />
      <Line points={seg(f[1], b[1])} color={color} lineWidth={hovered ? 3 : 2} />
      <Line points={seg(f[2], b[2])} color={color} lineWidth={hovered ? 3 : 2} />
      <Line points={seg(f[3], b[3])} color={color} lineWidth={hovered ? 3 : 2} />
      {progress >= 1 && (
        <Line
          points={[...f.map((p) => [p[0], p[1], 0] as [number, number, number]), [f[0][0], f[0][1], 0]]}
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

export function CylinderOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawCylinderOp>) {
  const ellipseRy = op.radius * 0.35;
  const topY = op.center[1] + op.height / 2;
  const bottomY = op.center[1] - op.height / 2;

  const topPoints = useMemo(
    () => ellipsePoints([op.center[0], topY], op.radius, ellipseRy, progress),
    [op.center, topY, op.radius, ellipseRy, progress]
  );
  const bottomPoints = useMemo(
    () => ellipsePoints([op.center[0], bottomY], op.radius, ellipseRy, progress),
    [op.center, bottomY, op.radius, ellipseRy, progress]
  );

  if (progress <= 0) return null;
  const color = hovered ? colors.highlightStroke : colors.ink;

  return (
    <group>
      <Line points={topPoints} color={color} lineWidth={hovered ? 3 : 2} />
      <Line points={bottomPoints} color={color} lineWidth={hovered ? 3 : 2} />
      {progress >= 1 && (
        <>
          <Line points={seg([op.center[0] - op.radius, topY], [op.center[0] - op.radius, bottomY])} color={color} lineWidth={2} />
          <Line points={seg([op.center[0] + op.radius, topY], [op.center[0] + op.radius, bottomY])} color={color} lineWidth={2} />
        </>
      )}
      {progress >= 1 && (
        <Line
          points={[...topPoints, ...bottomPoints]}
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

export function ConeOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawConeOp>) {
  const ellipseRy = op.radius * 0.35;
  const basePoints = useMemo(
    () => ellipsePoints(op.baseCenter, op.radius, ellipseRy, progress),
    [op.baseCenter, op.radius, ellipseRy, progress]
  );

  if (progress <= 0) return null;
  const color = hovered ? colors.highlightStroke : colors.ink;
  const left: [number, number] = [op.baseCenter[0] - op.radius, op.baseCenter[1]];
  const right: [number, number] = [op.baseCenter[0] + op.radius, op.baseCenter[1]];

  return (
    <group>
      <Line points={basePoints} color={color} lineWidth={hovered ? 3 : 2} />
      {progress >= 1 && (
        <>
          <Line points={seg(left, op.apex)} color={color} lineWidth={hovered ? 3 : 2} />
          <Line points={seg(right, op.apex)} color={color} lineWidth={hovered ? 3 : 2} />
        </>
      )}
      {progress >= 1 && (
        <Line
          points={[...basePoints, [op.apex[0], op.apex[1], 0]]}
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

export function SphereOutlineOp({ op, progress, hovered, onHoverChange, colors }: OpPrimitiveProps<DrawSphereOutlineOp>) {
  const outline = useMemo(() => arcPoints(op.center, op.radius, 0, Math.PI * 2, progress), [op.center, op.radius, progress]);
  const equator = useMemo(
    () => ellipsePoints(op.center, op.radius, op.radius * 0.32, progress),
    [op.center, op.radius, progress]
  );
  const meridian = useMemo(
    () => ellipsePoints(op.center, op.radius * 0.32, op.radius, progress),
    [op.center, op.radius, progress]
  );

  if (progress <= 0) return null;
  const color = hovered ? colors.highlightStroke : colors.ink;

  return (
    <group>
      <Line points={outline} color={color} lineWidth={hovered ? 3 : 2} />
      <Line points={equator} color={colors.mutedInk} lineWidth={1.2} />
      <Line points={meridian} color={colors.mutedInk} lineWidth={1.2} />
      {progress >= 1 && (
        <Line
          points={outline}
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
