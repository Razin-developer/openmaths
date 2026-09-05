import type { DrawOp, Point2, Scene } from "@/lib/dsl/types";
import { evaluateExpr, formatExprResult } from "@/lib/dsl/expr";

function applyNumeric(op: DrawOp, field: string, index: number | undefined, component: 0 | 1 | undefined, value: number) {
  const target = op as unknown as Record<string, unknown>;

  if (field === "metaValue") {
    const meta = { ...(target.meta as Record<string, unknown> | undefined) };
    meta.value = formatExprResult(value);
    target.meta = meta;
    return;
  }

  if (index !== undefined) {
    // Array-of-points field (draw_polygon.points)
    const points = target[field] as Point2[] | undefined;
    if (!Array.isArray(points) || !points[index]) return;
    const point = points[index];
    const nextPoint: Point2 = component === 1 ? [point[0], value] : [value, point[1]];
    target[field] = points.map((p, i) => (i === index ? nextPoint : p));
    return;
  }

  if (component !== undefined) {
    // Point2-shaped field (at/center/vertex/arm1/arm2/from/to)
    const point = target[field] as Point2 | undefined;
    if (!point) return;
    target[field] = (component === 1 ? [point[0], value] : [value, point[1]]) as Point2;
    return;
  }

  // Plain numeric field (radius, etc.)
  target[field] = value;
}

function applyTemplate(op: DrawOp, field: string, template: string, vars: Record<string, number>) {
  const text = template.replace(/\{([^}]+)\}/g, (_, expr) => {
    try {
      return formatExprResult(evaluateExpr(expr, vars));
    } catch {
      return "?";
    }
  });

  if (field === "metaValue") {
    const target = op as unknown as Record<string, unknown>;
    const meta = { ...(target.meta as Record<string, unknown> | undefined) };
    meta.value = text;
    target.meta = meta;
    return;
  }

  (op as unknown as Record<string, unknown>)[field] = text;
}

/**
 * Evaluates a parametric scene's bindings against the current slider values and returns a fully
 * resolved, plain-numeric Scene — the renderer never sees expressions, only numbers, exactly
 * like a non-parametric scene. Returns the input unchanged (same reference) when there's nothing
 * to resolve, so this is cheap to call on every render for non-parametric diagrams.
 */
export function resolveScene(scene: Scene, values: Record<string, number>): Scene {
  if (!scene.bindings || scene.bindings.length === 0) return scene;

  const ops = scene.ops.map((op) => ({ ...op }) as DrawOp);
  const byId = new Map(ops.map((op) => [op.id, op]));

  for (const binding of scene.bindings) {
    const op = byId.get(binding.opId);
    if (!op) continue;

    try {
      if (binding.template !== undefined) {
        applyTemplate(op, binding.field, binding.template, values);
      } else if (binding.expr !== undefined) {
        const value = evaluateExpr(binding.expr, values);
        applyNumeric(op, binding.field, binding.index, binding.component, value);
      }
    } catch (err) {
      console.error(`[resolveScene] binding failed for op ${binding.opId}.${binding.field}:`, err);
    }
  }

  return { ...scene, ops };
}

/** Initial slider values — each variable's own default. */
export function defaultVariableValues(scene: Scene): Record<string, number> {
  return Object.fromEntries((scene.variables ?? []).map((v) => [v.id, v.default]));
}
