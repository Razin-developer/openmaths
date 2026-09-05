"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * Analytics (PRD §8: "privacy-friendly (Plausible/PostHog); Core Web Vitals reporting").
 * No-ops entirely when `NEXT_PUBLIC_POSTHOG_KEY` is unset — a missing key should mean "analytics
 * off," not a broken `posthog.init(undefined)` call, so this stays safe to deploy without one.
 *
 * `person_profiles: "identified_only"` (not the default "always") — a visitor who never signs in
 * or explicitly identifies stays anonymous/event-only rather than getting a full tracked profile,
 * the more privacy-respecting of PostHog's two documented options for exactly this trade-off.
 * `capture_pageview: false` + the router-driven capture below is PostHog's own documented pattern
 * for the App Router specifically: the client-side router doesn't fire a full page load PostHog's
 * default autocapture listens for, so pageviews need to be sent manually on route change instead.
 */
function initPostHog() {
  if (!POSTHOG_KEY || posthog.__loaded) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false,
  });
}

function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    const url = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <>
      {/* useSearchParams requires a Suspense boundary in the App Router — isolated to this
       * invisible tracker so it can't block or flash any real page content. */}
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </>
  );
}
