"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const CAPTIONS = ["Right triangle: legs 6 and 8", "6² + 8² = 36 + 64 = 100", "10² = 100, so the hypotenuse is 10"];

/**
 * The PRD's named "signature moment" (§2/§5.2): the product literally drawing a proof and
 * narrating it, looping. Full scope (real synced voice narration, the app's actual DSL/scene
 * engine) is real future work — that engine lives in `app/src/components/engine/*` and isn't a
 * shared package yet, so extracting it is its own project, not something to fold into this
 * checkpoint. This is a self-contained SVG + GSAP stand-in that proves the same idea: a real
 * geometric proof (6-8-10 right triangle, the Pythagorean relationship) drawing itself with
 * synced step captions — text narration only, no audio, but the same "watch it explain" thesis.
 */
export function SignatureHero() {
  const legARef = useRef<SVGLineElement>(null);
  const legBRef = useRef<SVGLineElement>(null);
  const hypRef = useRef<SVGLineElement>(null);
  const [captionIndex, setCaptionIndex] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const lines = [legARef.current, legBRef.current, hypRef.current];
    for (const line of lines) {
      if (!line) continue;
      const length = line.getTotalLength();
      gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });
    tl.to(legARef.current, { strokeDashoffset: 0, duration: 0.5, ease: "power2.out" })
      .to(legBRef.current, { strokeDashoffset: 0, duration: 0.5, ease: "power2.out" }, "-=0.1")
      .call(() => setCaptionIndex(0))
      .to(hypRef.current, { strokeDashoffset: 0, duration: 0.6, ease: "power2.out" }, "+=0.3")
      .call(() => setCaptionIndex(1), undefined, "+=0.2")
      .call(() => setCaptionIndex(2), undefined, "+=1.4")
      .to({}, { duration: 1.6 }); // hold the completed proof before looping

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <svg viewBox="0 0 320 240" className="h-auto w-full max-w-[420px]" aria-hidden>
        <line x1="40" y1="200" x2="40" y2="60" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" ref={legARef} />
        <line x1="40" y1="200" x2="240" y2="200" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" ref={legBRef} />
        <line x1="40" y1="60" x2="240" y2="200" stroke="var(--foreground)" strokeWidth="4" strokeLinecap="round" ref={hypRef} />
        <text x="18" y="132" fill="var(--muted-foreground)" fontSize="16">
          6
        </text>
        <text x="130" y="220" fill="var(--muted-foreground)" fontSize="16">
          8
        </text>
        <text x="150" y="115" fill="var(--muted-foreground)" fontSize="16">
          10
        </text>
      </svg>
      <p role="status" className="text-body font-mono text-muted-foreground">
        {CAPTIONS[captionIndex]}
      </p>
    </div>
  );
}
