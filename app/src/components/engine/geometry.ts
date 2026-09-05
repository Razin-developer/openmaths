import * as THREE from "three";
import type { Point2 } from "@/lib/dsl/types";

export function arcPoints(
  center: Point2,
  radius: number,
  startAngle: number,
  endAngle: number,
  progress: number,
  segments = 48
): [number, number, number][] {
  const sweptEnd = startAngle + (endAngle - startAngle) * progress;
  const steps = Math.max(2, Math.round(segments * Math.max(progress, 0.02)));
  const points: [number, number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = startAngle + (sweptEnd - startAngle) * (i / steps);
    points.push([center[0] + Math.cos(t) * radius, center[1] + Math.sin(t) * radius, 0]);
  }
  return points;
}

export function angleBetween(vertex: Point2, arm1: Point2, arm2: Point2): { start: number; end: number } {
  return {
    start: Math.atan2(arm1[1] - vertex[1], arm1[0] - vertex[0]),
    end: Math.atan2(arm2[1] - vertex[1], arm2[0] - vertex[0]),
  };
}

export function midpoint(a: Point2, b: Point2): Point2 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function perpendicularOffset(a: Point2, b: Point2, distance: number): Point2 {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [(-dy / len) * distance, (dx / len) * distance];
}

export function makeShape(points: Point2[]): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  return shape;
}

/** Three points forming a small filled arrowhead triangle at `tip`, pointing along `angle` (radians). */
export function arrowHeadPoints(tip: Point2, angle: number, size = 0.16): Point2[] {
  const spread = 0.45; // radians off-axis for each wing
  const back = size * 1.3;
  const wing1: Point2 = [tip[0] - Math.cos(angle - spread) * back, tip[1] - Math.sin(angle - spread) * back];
  const wing2: Point2 = [tip[0] - Math.cos(angle + spread) * back, tip[1] - Math.sin(angle + spread) * back];
  return [tip, wing1, wing2];
}

/** Points along an ellipse (optionally rotated), for a fraction `progress` of its full sweep. */
export function ellipsePoints(
  center: Point2,
  radiusX: number,
  radiusY: number,
  progress: number,
  rotation = 0,
  segments = 48
): [number, number, number][] {
  const steps = Math.max(2, Math.round(segments * Math.max(progress, 0.02)));
  const points: [number, number, number][] = [];
  const sweep = Math.PI * 2 * progress;
  for (let i = 0; i <= steps; i++) {
    const t = sweep * (i / steps);
    const x = Math.cos(t) * radiusX;
    const y = Math.sin(t) * radiusY;
    const rx = x * Math.cos(rotation) - y * Math.sin(rotation);
    const ry = x * Math.sin(rotation) + y * Math.cos(rotation);
    points.push([center[0] + rx, center[1] + ry, 0]);
  }
  return points;
}

/** Vertices of a regular n-gon inscribed in a circle — default rotation puts the first vertex
 * straight up, matching how regular polygons are conventionally drawn. */
export function regularPolygonPoints(center: Point2, radius: number, sides: number, rotation = -Math.PI / 2): Point2[] {
  const n = Math.max(3, Math.round(sides));
  const points: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const angle = rotation + (i / n) * Math.PI * 2;
    points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
  }
  return points;
}

/** Samples a cubic bezier curve for a fraction `progress` of its length. */
export function bezierPoints(
  from: Point2,
  c1: Point2,
  c2: Point2,
  to: Point2,
  progress: number,
  segments = 32
): [number, number, number][] {
  const steps = Math.max(2, Math.round(segments * Math.max(progress, 0.02)));
  const points: [number, number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = progress * (i / steps);
    const mt = 1 - t;
    const x = mt * mt * mt * from[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * to[0];
    const y = mt * mt * mt * from[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * to[1];
    points.push([x, y, 0]);
  }
  return points;
}
