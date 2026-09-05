"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scroll (PRD §4 stack: Lenis) wired into GSAP's own ticker so ScrollTrigger's scroll
 * position stays in sync with Lenis's virtual scroll instead of the raw (unsmoothed) native one —
 * the standard Lenis+GSAP integration, since ScrollTrigger reads `window.scrollY` by default and
 * would otherwise fire against a value Lenis has already diverged from.
 *
 * No-ops entirely under `prefers-reduced-motion` — smooth-scrolling itself is a motion effect,
 * and forcing it on a user who asked for less motion would be exactly the "gimmicky, not awesome"
 * failure mode the PRD's own motion discipline section (§4) warns against.
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    };
  }, []);

  return <>{children}</>;
}
