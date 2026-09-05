/**
 * The AI drawing DSL: a flat, sequential list of drawing operations.
 * The LLM emits this JSON shape; SceneInterpreter walks it to render + animate
 * the diagram, and it is also the source of truth for hover-highlight linking
 * (via `id`/`targetId`) and step-by-step reveal (via `step`).
 */

export type Point2 = [number, number];

export type SemanticColor = "ink" | "muted" | "highlight";

export interface OpMeta {
  label?: string;
  value?: string | number;
  color?: SemanticColor;
}

interface BaseOp {
  id: string;
  step: number;
  highlightable?: boolean;
  meta?: OpMeta;
}

export interface MoveCursorOp extends BaseOp {
  op: "move_cursor";
  to: Point2;
  duration?: number;
}

export interface DrawLineOp extends BaseOp {
  op: "draw_line";
  from: Point2;
  to: Point2;
}

export interface DrawPolygonOp extends BaseOp {
  op: "draw_polygon";
  points: Point2[];
  filled?: boolean;
}

export interface DrawCircleOp extends BaseOp {
  op: "draw_circle";
  center: Point2;
  radius: number;
}

export interface DrawArcOp extends BaseOp {
  op: "draw_arc";
  center: Point2;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface LabelAngleOp extends BaseOp {
  op: "label_angle";
  vertex: Point2;
  arm1: Point2;
  arm2: Point2;
  targetId?: string;
}

export interface LabelSideOp extends BaseOp {
  op: "label_side";
  from: Point2;
  to: Point2;
  targetId?: string;
}

export interface PlaceTextOp extends BaseOp {
  op: "place_text";
  at: Point2;
  text: string;
  size?: "sm" | "md" | "lg";
}

export interface WriteNoteOp extends BaseOp {
  op: "write_note";
  text: string;
  /** A short "why is this true" explanation shown on demand (e.g. "Alternate interior angles are equal because DE ∥ BC"). */
  reason?: string;
}

export interface StepMarkerOp extends BaseOp {
  op: "step_start" | "step_end";
  title?: string;
  /** A fuller explanation of what this step does and why, shown in the fullscreen step sidebar
   * (title is just the short label). Only meaningful on step_start. */
  description?: string;
}

// --- Extended geometry ops -------------------------------------------------

export interface DrawRayOp extends BaseOp {
  op: "draw_ray";
  from: Point2;
  to: Point2;
}

export interface DrawVectorOp extends BaseOp {
  op: "draw_vector";
  from: Point2;
  to: Point2;
}

export interface DrawDashedLineOp extends BaseOp {
  op: "draw_dashed_line";
  from: Point2;
  to: Point2;
}

export interface DrawPointOp extends BaseOp {
  op: "draw_point";
  at: Point2;
}

export interface DrawTickMarksOp extends BaseOp {
  op: "draw_tick_marks";
  from: Point2;
  to: Point2;
  /** 1-3 tick marks — matching counts on different sides means "these are equal". */
  count?: number;
}

export interface DrawRightAngleMarkOp extends BaseOp {
  op: "draw_right_angle_mark";
  vertex: Point2;
  arm1: Point2;
  arm2: Point2;
  size?: number;
}

export interface DrawParallelMarksOp extends BaseOp {
  op: "draw_parallel_marks";
  from: Point2;
  to: Point2;
  /** 1-2 chevrons — matching counts on different lines means "these are parallel". */
  count?: number;
}

export interface DrawEllipseOp extends BaseOp {
  op: "draw_ellipse";
  center: Point2;
  radiusX: number;
  radiusY: number;
  rotation?: number;
}

export interface DrawParabolaOp extends BaseOp {
  op: "draw_parabola";
  vertex: Point2;
  coefficient: number;
  xRange: [number, number];
}

export interface DrawFunctionOp extends BaseOp {
  op: "draw_function";
  /** Expression in terms of "x" (see lib/dsl/expr.ts syntax), e.g. "sin(x)", "x^2 - 4". */
  expr: string;
  xRange: [number, number];
  samples?: number;
}

export interface DrawBezierOp extends BaseOp {
  op: "draw_bezier";
  from: Point2;
  control1: Point2;
  control2: Point2;
  to: Point2;
}

export interface DrawGridOp extends BaseOp {
  op: "draw_grid";
  boundingBox: BoundingBox;
  spacing: number;
}

export interface DrawAxesOp extends BaseOp {
  op: "draw_axes";
  origin: Point2;
  xLength: number;
  yLength: number;
}

export interface ShadeRegionOp extends BaseOp {
  op: "shade_region";
  points: Point2[];
  opacity?: number;
}

export interface DrawBracketOp extends BaseOp {
  op: "draw_bracket";
  from: Point2;
  to: Point2;
  label?: string;
}

export interface DrawCurvedArrowOp extends BaseOp {
  op: "draw_curved_arrow";
  center: Point2;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface DrawCuboidOp extends BaseOp {
  op: "draw_cuboid";
  origin: Point2;
  width: number;
  height: number;
  depth: number;
}

export interface DrawCylinderOp extends BaseOp {
  op: "draw_cylinder";
  center: Point2;
  radius: number;
  height: number;
}

export interface DrawConeOp extends BaseOp {
  op: "draw_cone";
  apex: Point2;
  baseCenter: Point2;
  radius: number;
}

export interface DrawSphereOutlineOp extends BaseOp {
  op: "draw_sphere_outline";
  center: Point2;
  radius: number;
}

export interface DrawRegularPolygonOp extends BaseOp {
  op: "draw_regular_polygon";
  center: Point2;
  radius: number;
  /** 3+ — a triangle here is always equilateral; use draw_polygon for any non-regular triangle. */
  sides: number;
  /** Radians; default points the first vertex straight up. */
  rotation?: number;
  filled?: boolean;
}

export type DrawOp =
  | MoveCursorOp
  | DrawLineOp
  | DrawPolygonOp
  | DrawCircleOp
  | DrawArcOp
  | LabelAngleOp
  | LabelSideOp
  | PlaceTextOp
  | WriteNoteOp
  | StepMarkerOp
  | DrawRayOp
  | DrawVectorOp
  | DrawDashedLineOp
  | DrawPointOp
  | DrawTickMarksOp
  | DrawRightAngleMarkOp
  | DrawParallelMarksOp
  | DrawEllipseOp
  | DrawParabolaOp
  | DrawFunctionOp
  | DrawBezierOp
  | DrawGridOp
  | DrawAxesOp
  | ShadeRegionOp
  | DrawBracketOp
  | DrawCurvedArrowOp
  | DrawCuboidOp
  | DrawCylinderOp
  | DrawConeOp
  | DrawSphereOutlineOp
  | DrawRegularPolygonOp;

export type OpType = DrawOp["op"];

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A slider-adjustable parameter (e.g. a side length or radius) for a parametric diagram. */
export interface SceneVariable {
  id: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  /** Shown after the value, e.g. "cm". */
  unit?: string;
}

/**
 * A live recomputation rule: whenever a SceneVariable changes, re-evaluate an expression and
 * write the result into one op's field — this is what makes a diagram parametric. Exactly one of
 * `expr` (numeric fields) or `template` (text fields, with {expr} placeholders) is set.
 */
export interface SceneBinding {
  /** id of the op to update. */
  opId: string;
  /** Field name on that op, e.g. "radius", "at", "center", "points", "text". */
  field: string;
  /** For array-of-points fields (draw_polygon.points) — which point to update. */
  index?: number;
  /** For a Point2-shaped field — which coordinate (0 = x, 1 = y) to update. Omit to replace the
   * whole field (only valid when the field is a plain number, e.g. "radius"). */
  component?: 0 | 1;
  /** A math expression (see lib/dsl/expr.ts) referencing SceneVariable ids, evaluated to a
   * number — for numeric fields/coordinates. */
  expr?: string;
  /** A text template with {expr} placeholders, e.g. "A = s^2 = {s^2}" — for the "text" field of
   * place_text/write_note, or meta.value of label_angle/label_side. */
  template?: string;
}

export interface Scene {
  version: 1;
  boundingBox?: BoundingBox;
  ops: DrawOp[];
  /** Present only on parametric diagrams — see SceneVariable/SceneBinding. */
  variables?: SceneVariable[];
  bindings?: SceneBinding[];
}

/** Ops that carry visible geometry/text and are meaningful to hover-highlight. */
export const GEOMETRY_OPS: ReadonlySet<OpType> = new Set([
  "draw_line",
  "draw_polygon",
  "draw_circle",
  "draw_arc",
  "label_angle",
  "label_side",
  "place_text",
  "draw_ray",
  "draw_vector",
  "draw_dashed_line",
  "draw_point",
  "draw_ellipse",
  "draw_parabola",
  "draw_function",
  "draw_bezier",
  "shade_region",
  "draw_bracket",
  "draw_curved_arrow",
  "draw_cuboid",
  "draw_cylinder",
  "draw_cone",
  "draw_sphere_outline",
  "draw_regular_polygon",
]);

export function isHighlightable(op: DrawOp): boolean {
  return op.highlightable ?? GEOMETRY_OPS.has(op.op);
}

export function sceneSteps(scene: Scene): number[] {
  const steps = new Set(scene.ops.map((op) => op.step));
  return Array.from(steps).sort((a, b) => a - b);
}
