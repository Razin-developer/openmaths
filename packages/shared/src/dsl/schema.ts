import { z } from "zod";

const Point2Schema = z.tuple([z.number(), z.number()]);

const OpMetaSchema = z.object({
  label: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  color: z.enum(["ink", "muted", "highlight"]).optional(),
});

const BaseOpSchema = {
  id: z.string().min(1),
  step: z.number().int().min(0),
  highlightable: z.boolean().optional(),
  meta: OpMetaSchema.optional(),
};

const MoveCursorOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("move_cursor"),
  to: Point2Schema,
  duration: z.number().positive().optional(),
});

const DrawLineOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_line"),
  from: Point2Schema,
  to: Point2Schema,
});

const DrawPolygonOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_polygon"),
  points: z.array(Point2Schema).min(3),
  filled: z.boolean().optional(),
});

const DrawCircleOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_circle"),
  center: Point2Schema,
  radius: z.number().positive(),
});

const DrawArcOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_arc"),
  center: Point2Schema,
  radius: z.number().positive(),
  startAngle: z.number(),
  endAngle: z.number(),
});

const LabelAngleOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("label_angle"),
  vertex: Point2Schema,
  arm1: Point2Schema,
  arm2: Point2Schema,
  targetId: z.string().optional(),
});

const LabelSideOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("label_side"),
  from: Point2Schema,
  to: Point2Schema,
  targetId: z.string().optional(),
});

const PlaceTextOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("place_text"),
  at: Point2Schema,
  text: z.string().min(1),
  size: z.enum(["sm", "md", "lg"]).optional(),
});

const WriteNoteOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("write_note"),
  text: z.string().min(1),
  reason: z.string().optional(),
});

const StepMarkerOpSchema = z.object({
  ...BaseOpSchema,
  op: z.enum(["step_start", "step_end"]),
  title: z.string().optional(),
  /** A fuller explanation of what this step does and why, shown in the fullscreen step sidebar
   * (title is just the short label). Only meaningful on step_start. */
  description: z.string().optional(),
});

const DrawRayOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_ray"),
  from: Point2Schema,
  to: Point2Schema,
});

const DrawVectorOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_vector"),
  from: Point2Schema,
  to: Point2Schema,
});

const DrawDashedLineOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_dashed_line"),
  from: Point2Schema,
  to: Point2Schema,
});

const DrawPointOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_point"),
  at: Point2Schema,
});

const DrawTickMarksOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_tick_marks"),
  from: Point2Schema,
  to: Point2Schema,
  count: z.number().int().min(1).max(3).optional(),
});

const DrawRightAngleMarkOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_right_angle_mark"),
  vertex: Point2Schema,
  arm1: Point2Schema,
  arm2: Point2Schema,
  size: z.number().positive().optional(),
});

const DrawParallelMarksOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_parallel_marks"),
  from: Point2Schema,
  to: Point2Schema,
  count: z.number().int().min(1).max(2).optional(),
});

const DrawEllipseOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_ellipse"),
  center: Point2Schema,
  radiusX: z.number().positive(),
  radiusY: z.number().positive(),
  rotation: z.number().optional(),
});

const DrawParabolaOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_parabola"),
  vertex: Point2Schema,
  coefficient: z.number(),
  xRange: z.tuple([z.number(), z.number()]),
});

const DrawFunctionOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_function"),
  expr: z.string().min(1),
  xRange: z.tuple([z.number(), z.number()]),
  samples: z.number().int().min(2).max(200).optional(),
});

const DrawBezierOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_bezier"),
  from: Point2Schema,
  control1: Point2Schema,
  control2: Point2Schema,
  to: Point2Schema,
});

const DrawGridOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_grid"),
  boundingBox: z.object({
    minX: z.number(),
    minY: z.number(),
    maxX: z.number(),
    maxY: z.number(),
  }),
  spacing: z.number().positive(),
});

const DrawAxesOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_axes"),
  origin: Point2Schema,
  xLength: z.number().positive(),
  yLength: z.number().positive(),
});

const ShadeRegionOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("shade_region"),
  points: z.array(Point2Schema).min(3),
  opacity: z.number().min(0).max(1).optional(),
});

const DrawBracketOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_bracket"),
  from: Point2Schema,
  to: Point2Schema,
  label: z.string().optional(),
});

const DrawCurvedArrowOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_curved_arrow"),
  center: Point2Schema,
  radius: z.number().positive(),
  startAngle: z.number(),
  endAngle: z.number(),
});

const DrawCuboidOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_cuboid"),
  origin: Point2Schema,
  width: z.number().positive(),
  height: z.number().positive(),
  depth: z.number().positive(),
});

const DrawCylinderOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_cylinder"),
  center: Point2Schema,
  radius: z.number().positive(),
  height: z.number().positive(),
});

const DrawConeOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_cone"),
  apex: Point2Schema,
  baseCenter: Point2Schema,
  radius: z.number().positive(),
});

const DrawSphereOutlineOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_sphere_outline"),
  center: Point2Schema,
  radius: z.number().positive(),
});

const DrawRegularPolygonOpSchema = z.object({
  ...BaseOpSchema,
  op: z.literal("draw_regular_polygon"),
  center: Point2Schema,
  radius: z.number().positive(),
  sides: z.number().int().min(3).max(20),
  rotation: z.number().optional(),
  filled: z.boolean().optional(),
});

export const DrawOpSchema = z.discriminatedUnion("op", [
  MoveCursorOpSchema,
  DrawLineOpSchema,
  DrawPolygonOpSchema,
  DrawCircleOpSchema,
  DrawArcOpSchema,
  LabelAngleOpSchema,
  LabelSideOpSchema,
  PlaceTextOpSchema,
  WriteNoteOpSchema,
  StepMarkerOpSchema,
  DrawRayOpSchema,
  DrawVectorOpSchema,
  DrawDashedLineOpSchema,
  DrawPointOpSchema,
  DrawTickMarksOpSchema,
  DrawRightAngleMarkOpSchema,
  DrawParallelMarksOpSchema,
  DrawEllipseOpSchema,
  DrawParabolaOpSchema,
  DrawFunctionOpSchema,
  DrawBezierOpSchema,
  DrawGridOpSchema,
  DrawAxesOpSchema,
  ShadeRegionOpSchema,
  DrawBracketOpSchema,
  DrawCurvedArrowOpSchema,
  DrawCuboidOpSchema,
  DrawCylinderOpSchema,
  DrawConeOpSchema,
  DrawSphereOutlineOpSchema,
  DrawRegularPolygonOpSchema,
]);

const SceneVariableSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  min: z.number(),
  max: z.number(),
  default: z.number(),
  step: z.number().positive().optional(),
  unit: z.string().optional(),
});

const SceneBindingSchema = z
  .object({
    opId: z.string().min(1),
    field: z.string().min(1),
    index: z.number().int().min(0).optional(),
    component: z.union([z.literal(0), z.literal(1)]).optional(),
    expr: z.string().min(1).optional(),
    template: z.string().min(1).optional(),
  })
  .refine((b) => (b.expr === undefined) !== (b.template === undefined), {
    message: "exactly one of expr or template must be set",
  });

export const SceneSchema = z.object({
  version: z.literal(1),
  boundingBox: z
    .object({
      minX: z.number(),
      minY: z.number(),
      maxX: z.number(),
      maxY: z.number(),
    })
    .optional(),
  ops: z.array(DrawOpSchema).min(1).max(140),
  variables: z.array(SceneVariableSchema).max(3).optional(),
  bindings: z.array(SceneBindingSchema).max(60).optional(),
});

export type SceneParseResult =
  | { ok: true; scene: z.infer<typeof SceneSchema> }
  | { ok: false; error: string };
