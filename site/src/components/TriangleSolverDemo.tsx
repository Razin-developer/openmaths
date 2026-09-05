"use client";

import { useState } from "react";

/**
 * The PRD's "interactive Try it" section (§5.2 item 6): "an embedded real mini widget... the
 * visitor uses without signing up." A real, working Right-Triangle Solver — the same tool named
 * first in §6's mini-tools launch list — rather than a static screenshot or video. Its own
 * `/tools/right-triangle-solver` SEO landing page is P3's job; this is the same computation
 * embedded directly in the home page.
 */
export function TriangleSolverDemo() {
  const [legA, setLegA] = useState("6");
  const [legB, setLegB] = useState("8");

  const a = Number.parseFloat(legA);
  const b = Number.parseFloat(legB);
  const valid = Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0;
  const hypotenuse = valid ? Math.sqrt(a * a + b * b) : null;

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 rounded-xl border border-border bg-muted/40 p-8">
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-2 text-body-sm text-muted-foreground">
          Leg a
          <input
            type="number"
            value={legA}
            onChange={(e) => setLegA(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground"
            min="0"
          />
        </label>
        <label className="flex flex-1 flex-col gap-2 text-body-sm text-muted-foreground">
          Leg b
          <input
            type="number"
            value={legB}
            onChange={(e) => setLegB(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground"
            min="0"
          />
        </label>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-md bg-background py-6">
        <span className="text-caption text-muted-foreground">Hypotenuse (c = √(a² + b²))</span>
        <span className="text-h2 font-semibold tabular-nums">{hypotenuse ? hypotenuse.toFixed(2) : "—"}</span>
      </div>
      <p className="text-center text-body-sm text-muted-foreground">
        Want the full worked explanation, with a diagram and narrated steps?{" "}
        <a href="http://localhost:3000" className="text-accent underline underline-offset-4">
          Ask openmaths →
        </a>
      </p>
    </div>
  );
}
