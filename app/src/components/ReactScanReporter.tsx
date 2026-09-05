"use client";

import { useEffect } from "react";
import { scan } from "react-scan";

/**
 * Dev-tooling addition (PRD "Performance Audit & Answer-Rendering Fix" — react-scan): highlights
 * components as they re-render, including *unnecessary* re-renders (same props/state, rendered
 * anyway) — the class of bug this app's own hoisted-literal/memo fixes elsewhere in the codebase
 * were chasing by hand. Opt-in only (`?scan=1` on the URL, development only) so it never runs by
 * default and never ships to production — same gating convention as BlockCanvas's `?perf=1`
 * r3f-perf overlay.
 */
export function ReactScanReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (new URLSearchParams(window.location.search).get("scan") !== "1") return;
    // `trackUnnecessaryRenders` is documented in this version's own .d.ts but rejected as an
    // "unknown option" by its actual runtime validator (an upstream inconsistency in react-scan
    // 0.5.7 itself, confirmed live in this dev session) — omitted rather than shipping a warning
    // on every load. enabled/showToolbar cover the actual re-render-highlighting behavior.
    scan({ enabled: true, showToolbar: true });
  }, []);
  return null;
}
