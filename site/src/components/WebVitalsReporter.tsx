"use client";

import { useReportWebVitals } from "next/web-vitals";
import posthog from "posthog-js";

/** PRD §8/§9: "Core Web Vitals reporting" + the LCP/INP/CLS budgets §9 sets. Sends each metric to
 * PostHog as it's measured — a no-op when analytics is off (posthog-js's own capture() is a safe
 * no-op before init()), same as PostHogProvider's own pageview tracking. */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    posthog.capture("web_vitals", {
      metric_name: metric.name,
      value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      rating: metric.rating,
    });
  });
  return null;
}
