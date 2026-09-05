"use client";

import { useEffect, useState } from "react";

/** Tracks the `prefers-reduced-motion` media query live (not just at mount) — a user can toggle
 * their OS setting while the app is open. */
function matches(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function usePrefersReducedMotion(): boolean {
  // Lazy initializer reads the real value for the first render (this hook is client-only, so
  // `window` is always available by the time it runs) — the effect below only needs to handle
  // the OS setting changing later, not the initial read, avoiding a setState-in-effect.
  const [reduced, setReduced] = useState(matches);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
