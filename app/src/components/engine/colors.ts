"use client";

import { useTheme } from "@/components/theme-provider";

/**
 * Three.js materials render on a WebGL canvas, not the DOM, so they can't read
 * CSS custom properties. These hex values are kept in sync by hand with the
 * grayscale scale in globals.css — same two-tone monochrome constraint, just
 * duplicated into a form the engine can consume directly.
 */
export interface EngineColors {
  ink: string;
  mutedInk: string;
  faintInk: string;
  background: string;
  highlightFill: string;
  highlightStroke: string;
}

const LIGHT_COLORS: EngineColors = {
  ink: "#292929",
  mutedInk: "#8a8a8a",
  faintInk: "#c4c4c4",
  background: "#ffffff",
  highlightFill: "#00000012",
  highlightStroke: "#141414",
};

const DARK_COLORS: EngineColors = {
  ink: "#f2f2f2",
  mutedInk: "#9c9c9c",
  faintInk: "#5c5c5c",
  background: "#242424",
  highlightFill: "#ffffff1a",
  highlightStroke: "#fafafa",
};

export function useEngineColors(): EngineColors {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? DARK_COLORS : LIGHT_COLORS;
}
