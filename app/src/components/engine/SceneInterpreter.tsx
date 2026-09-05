"use client";

import { useMemo } from "react";
import type { DrawOp, Scene } from "@/lib/dsl/types";
import { useBlockStore } from "@/store/blockStore";
import { useEngineColors } from "@/components/engine/colors";
import { computeHighlightGroup } from "@/components/engine/highlight";
import { AiCursor } from "@/components/engine/AiCursor";
import { TimelineTicker } from "@/components/engine/TimelineTicker";
import { LineOp } from "@/components/engine/primitives/LineOp";
import { PolygonOp } from "@/components/engine/primitives/PolygonOp";
import { CircleArcOp } from "@/components/engine/primitives/CircleArcOp";
import { LabelAngleOp } from "@/components/engine/primitives/LabelAngleOp";
import { LabelSideOp } from "@/components/engine/primitives/LabelSideOp";
import { NoteOp } from "@/components/engine/primitives/NoteOp";
import { RayVectorOp } from "@/components/engine/primitives/RayVectorOp";
import { DashedLineOp } from "@/components/engine/primitives/DashedLineOp";
import { PointOp } from "@/components/engine/primitives/PointOp";
import { TickMarksOp, RightAngleMarkOp, ParallelMarksOp } from "@/components/engine/primitives/MarkOps";
import { EllipseOp } from "@/components/engine/primitives/EllipseOp";
import { ParabolaOp, FunctionPlotOp, BezierOp } from "@/components/engine/primitives/CurveOps";
import { GridOp, AxesOp } from "@/components/engine/primitives/GridAxesOp";
import { ShadeRegionOp } from "@/components/engine/primitives/ShadeRegionOp";
import { BracketOp } from "@/components/engine/primitives/BracketOp";
import { CurvedArrowOp } from "@/components/engine/primitives/CurvedArrowOp";
import { CuboidOp, CylinderOp, ConeOp, SphereOutlineOp } from "@/components/engine/primitives/Solid3DOps";
import { RegularPolygonOp } from "@/components/engine/primitives/RegularPolygonOp";

/** Ops that render nothing themselves (cursor movement, notes-panel content, step bookkeeping). */
function isSilentOp(op: DrawOp): boolean {
  return op.op === "move_cursor" || op.op === "write_note" || op.op === "step_start" || op.op === "step_end";
}

/** Progress (0-1) of a revealed op at `opIndex`, given current playback position. */
function progressFor(opIndex: number, currentOpIndex: number, opProgress: number): number {
  if (opIndex < currentOpIndex) return 1;
  if (opIndex === currentOpIndex) return opProgress;
  return 0;
}

export function SceneInterpreter({
  blockId,
  scene,
  mode = "live",
  hoverBlockId,
}: {
  blockId: string;
  scene: Scene;
  /** "static" shows every op fully revealed immediately, no ticking/cursor — used for inline previews. */
  mode?: "live" | "static";
  /** Key hover state is read/written under — defaults to blockId, but inline previews use a
   * separate playback-state key while external hover triggers (e.g. text mentions) still target
   * the real block id, so this lets both agree on where hover lives. */
  hoverBlockId?: string;
}) {
  const hoverKey = hoverBlockId ?? blockId;
  const currentOpIndex = useBlockStore((s) => (s.blocks[blockId] ?? s.get(blockId)).currentOpIndex);
  const opProgress = useBlockStore((s) => (s.blocks[blockId] ?? s.get(blockId)).opProgress);
  const hoveredOpId = useBlockStore((s) => (s.blocks[hoverKey] ?? s.get(hoverKey)).hoveredOpId);
  const setHovered = useBlockStore((s) => s.setHovered);
  const colors = useEngineColors();

  const highlightGroup = useMemo(
    () => computeHighlightGroup(scene.ops, hoveredOpId),
    [scene.ops, hoveredOpId]
  );

  const onHoverChange = (opId: string | null) => setHovered(hoverKey, opId);

  return (
    <>
      {mode === "live" && (
        <>
          <TimelineTicker blockId={blockId} scene={scene} />
          <AiCursor scene={scene} currentOpIndex={currentOpIndex} opProgress={opProgress} visible />
        </>
      )}
      {scene.ops.map((op, index) => {
        if (isSilentOp(op)) return null;
        const progress = mode === "static" ? 1 : progressFor(index, currentOpIndex, opProgress);
        if (progress <= 0) return null;
        const hovered = highlightGroup.has(op.id);
        const shared = { progress, hovered, onHoverChange, colors } as const;

        switch (op.op) {
          case "draw_line":
            return <LineOp key={op.id} op={op} {...shared} />;
          case "draw_polygon":
            return <PolygonOp key={op.id} op={op} {...shared} />;
          case "draw_circle":
          case "draw_arc":
            return <CircleArcOp key={op.id} op={op} {...shared} />;
          case "label_angle":
            return <LabelAngleOp key={op.id} op={op} {...shared} />;
          case "label_side":
            return <LabelSideOp key={op.id} op={op} {...shared} />;
          case "place_text":
            return <NoteOp key={op.id} op={op} {...shared} />;
          case "draw_ray":
          case "draw_vector":
            return <RayVectorOp key={op.id} op={op} {...shared} />;
          case "draw_dashed_line":
            return <DashedLineOp key={op.id} op={op} {...shared} />;
          case "draw_point":
            return <PointOp key={op.id} op={op} {...shared} />;
          case "draw_tick_marks":
            return <TickMarksOp key={op.id} op={op} {...shared} />;
          case "draw_right_angle_mark":
            return <RightAngleMarkOp key={op.id} op={op} {...shared} />;
          case "draw_parallel_marks":
            return <ParallelMarksOp key={op.id} op={op} {...shared} />;
          case "draw_ellipse":
            return <EllipseOp key={op.id} op={op} {...shared} />;
          case "draw_parabola":
            return <ParabolaOp key={op.id} op={op} {...shared} />;
          case "draw_function":
            return <FunctionPlotOp key={op.id} op={op} {...shared} />;
          case "draw_bezier":
            return <BezierOp key={op.id} op={op} {...shared} />;
          case "draw_grid":
            return <GridOp key={op.id} op={op} {...shared} />;
          case "draw_axes":
            return <AxesOp key={op.id} op={op} {...shared} />;
          case "shade_region":
            return <ShadeRegionOp key={op.id} op={op} {...shared} />;
          case "draw_bracket":
            return <BracketOp key={op.id} op={op} {...shared} />;
          case "draw_curved_arrow":
            return <CurvedArrowOp key={op.id} op={op} {...shared} />;
          case "draw_cuboid":
            return <CuboidOp key={op.id} op={op} {...shared} />;
          case "draw_cylinder":
            return <CylinderOp key={op.id} op={op} {...shared} />;
          case "draw_cone":
            return <ConeOp key={op.id} op={op} {...shared} />;
          case "draw_sphere_outline":
            return <SphereOutlineOp key={op.id} op={op} {...shared} />;
          case "draw_regular_polygon":
            return <RegularPolygonOp key={op.id} op={op} {...shared} />;
          default:
            return null;
        }
      })}
    </>
  );
}
