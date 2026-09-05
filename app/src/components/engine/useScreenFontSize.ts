"use client";

import { useThree } from "@react-three/fiber";

/**
 * Converts a target on-screen pixel size into the world-space font size that renders at
 * that pixel size under the current orthographic zoom. Without this, a fixed world-unit
 * fontSize renders huge in the zoomed-in fullscreen view but nearly invisible in the small
 * Graph node preview, since FitCamera computes a very different zoom for each container.
 */
export function useScreenFontSize(targetPixels: number): number {
  const zoom = useThree((s) => s.camera.zoom);
  return targetPixels / (zoom || 1);
}
