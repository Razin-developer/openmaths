import type { Scene } from "@/lib/dsl/types";

/**
 * PRD "Performance Audit & Answer-Rendering Fix" B3 — once a static-mode diagram is captured to a
 * raster snapshot and its live Three.js camera is torn down, the hover-highlight tooltip
 * (previously drei's `<Html>`, which projects through a real camera) has no camera left to
 * project through. This is the same math `applyCameraFit` in BlockCanvas.tsx sets on that camera,
 * inverted into a pure function — an orthographic camera's projection is linear, so no Three.js
 * instance is actually needed to reproduce it.
 */
export function projectWorldToScreen(
  world: readonly [number, number],
  fit: { cx: number; cy: number; zoom: number },
  size: { width: number; height: number }
): { x: number; y: number } {
  const viewWidth = size.width / fit.zoom;
  const viewHeight = size.height / fit.zoom;
  const normX = (world[0] - fit.cx) / viewWidth + 0.5;
  const normY = (world[1] - fit.cy) / viewHeight + 0.5;
  return { x: normX * size.width, y: (1 - normY) * size.height };
}

/**
 * Cheap, non-cryptographic content hash (FNV-1a) of a scene's drawing ops — used as a snapshot
 * cache key instead of the `scene` object's identity, since every fresh API response/board sync
 * produces a brand-new `scene` object even when its actual content is byte-identical (JSON parsed
 * fresh each time), which would otherwise invalidate the raster-preview cache on every poll.
 */
export function hashSceneContent(scene: Scene): string {
  const str = JSON.stringify(scene.ops) + JSON.stringify(scene.boundingBox ?? null);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
