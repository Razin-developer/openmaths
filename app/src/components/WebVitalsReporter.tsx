"use client";

import { useReportWebVitals } from "next/web-vitals";

/** PRD "Performance Audit & Answer-Rendering Fix" §4 instrumentation — logs Core Web Vitals
 * (LCP, INP, CLS, TTFB, FCP) to the console as they're measured. INP is the "feels laggy" signal
 * this PRD cares about most (>200ms = noticeable). Console-only for now (no RUM backend wired up
 * — that's the PRD's own "later" item); the point is having real numbers to check against the
 * before/after of the P0 fixes in this pass, not building a metrics pipeline. */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const rounded = Math.round(metric.value * 100) / 100;
    console.log(`[web-vitals] ${metric.name}: ${rounded}${metric.name === "CLS" ? "" : "ms"} (${metric.rating})`);
  });
  return null;
}
