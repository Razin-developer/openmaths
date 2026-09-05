"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, animate } from "motion/react";

interface StatCounterProps {
  value: number;
  suffix?: string;
  label: string;
}

/** An animated number counter (PRD §4 named pattern), counting up once when scrolled into view.
 * Renders the final value immediately under reduced motion — counting up is decorative, not
 * informational, so skipping straight to the answer loses nothing. */
export function StatCounter({ value, suffix = "", label }: StatCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const count = useMotionValue(reduceMotion ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, value, reduceMotion, count]);

  useEffect(() => {
    const unsubscribe = count.on("change", (latest) => {
      if (ref.current) ref.current.textContent = Math.round(latest).toLocaleString();
    });
    return unsubscribe;
  }, [count]);

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-h1 font-semibold tabular-nums">
        <span ref={ref}>0</span>
        {suffix}
      </span>
      <span className="text-body-sm text-muted-foreground">{label}</span>
    </div>
  );
}
