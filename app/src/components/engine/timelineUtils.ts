import type { DrawOp, Point2, Scene } from "@/lib/dsl/types";

function dist(a: Point2, b: Point2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Seconds a given op should take to animate, scaled roughly by visual complexity. */
export function getOpDuration(op: DrawOp): number {
  switch (op.op) {
    case "move_cursor":
      return op.duration ?? 0.35;
    case "draw_line":
      return Math.min(0.25 + dist(op.from, op.to) * 0.08, 0.9);
    case "draw_polygon":
      return Math.min(0.2 * op.points.length, 1.4);
    case "draw_circle":
      return 0.6;
    case "draw_arc":
      return 0.45;
    case "label_angle":
    case "label_side":
      return 0.35;
    case "place_text":
      return 0.3;
    case "write_note":
      return 0.2;
    case "step_start":
    case "step_end":
      return 0.05;
    default:
      return 0.3;
  }
}

export function getOpDurations(ops: DrawOp[]): number[] {
  return ops.map(getOpDuration);
}

/** Each op's `step` value, parallel to getOpDurations — used to detect step-boundary crossings during playback. */
export function getOpSteps(ops: DrawOp[]): number[] {
  return ops.map((op) => op.step);
}

/** Maps each distinct `step` value to the index of its first op in the flattened ops array. */
export function buildStepIndex(ops: DrawOp[]): { steps: number[]; firstOpIndexByStep: Map<number, number> } {
  const firstOpIndexByStep = new Map<number, number>();
  const steps: number[] = [];
  ops.forEach((op, index) => {
    if (!firstOpIndexByStep.has(op.step)) {
      firstOpIndexByStep.set(op.step, index);
      steps.push(op.step);
    }
  });
  steps.sort((a, b) => a - b);
  return { steps, firstOpIndexByStep };
}

export function stepForOpIndex(scene: Scene, opIndex: number): number {
  return scene.ops[Math.min(opIndex, scene.ops.length - 1)]?.step ?? 0;
}

function lerp(a: Point2, b: Point2, t: number): Point2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function pointOnArc(center: Point2, radius: number, startAngle: number, endAngle: number, t: number): Point2 {
  const angle = startAngle + (endAngle - startAngle) * t;
  return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
}

/**
 * The AI cursor's position at a given point in playback: the tip of whatever is
 * currently being drawn, or the last drawn point if the current op doesn't move a pen.
 */
export function getCursorPosition(ops: DrawOp[], currentOpIndex: number, opProgress: number): Point2 | null {
  let lastPoint: Point2 | null = null;

  for (let i = 0; i <= Math.min(currentOpIndex, ops.length - 1); i++) {
    const op = ops[i];
    const t = i === currentOpIndex ? opProgress : 1;

    switch (op.op) {
      case "move_cursor":
        lastPoint = lastPoint ? lerp(lastPoint, op.to, t) : op.to;
        break;
      case "draw_line":
        lastPoint = lerp(op.from, op.to, t);
        break;
      case "draw_polygon": {
        const segments = op.points.length;
        const scaled = t * segments;
        const segIndex = Math.min(Math.floor(scaled), segments - 1);
        const segT = scaled - segIndex;
        const from = op.points[segIndex];
        const to = op.points[(segIndex + 1) % segments];
        lastPoint = lerp(from, to, segT);
        break;
      }
      case "draw_circle":
        lastPoint = pointOnArc(op.center, op.radius, 0, Math.PI * 2, t);
        break;
      case "draw_arc":
        lastPoint = pointOnArc(op.center, op.radius, op.startAngle, op.endAngle, t);
        break;
      default:
        break;
    }
  }

  return lastPoint;
}

const HEADING_EPSILON = 0.02;

/** Direction of travel at the current playback position, sampled by stepping back slightly in progress. No cross-render state needed. */
export function getCursorHeading(ops: DrawOp[], currentOpIndex: number, opProgress: number): number {
  const current = getCursorPosition(ops, currentOpIndex, opProgress);
  if (!current) return 0;

  const earlierProgress = opProgress - HEADING_EPSILON;
  const earlier =
    earlierProgress >= 0
      ? getCursorPosition(ops, currentOpIndex, earlierProgress)
      : currentOpIndex > 0
        ? getCursorPosition(ops, currentOpIndex - 1, 1)
        : null;

  if (!earlier) return 0;
  const dx = current[0] - earlier[0];
  const dy = current[1] - earlier[1];
  if (Math.hypot(dx, dy) < 1e-4) return 0;
  return Math.atan2(dy, dx) - Math.PI / 2;
}
