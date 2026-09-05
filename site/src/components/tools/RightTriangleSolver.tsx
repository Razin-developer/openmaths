"use client";

import { useState } from "react";
import { solveRightTriangle } from "@/lib/tools/rightTriangle";

/** Solves for whichever one of {legA, legB, hypotenuse} is left blank — matches how a real right
 * triangle problem is usually posed ("given these two, find the third"), not just "given two
 * legs" the way the home-page demo (a simpler, fixed version of this same tool) does. */
export function RightTriangleSolver() {
  const [legA, setLegA] = useState("6");
  const [legB, setLegB] = useState("8");
  const [hypotenuse, setHypotenuse] = useState("");

  const parsed = {
    legA: legA ? Number.parseFloat(legA) : undefined,
    legB: legB ? Number.parseFloat(legB) : undefined,
    hypotenuse: hypotenuse ? Number.parseFloat(hypotenuse) : undefined,
  };
  const filledCount = [parsed.legA, parsed.legB, parsed.hypotenuse].filter((n) => n !== undefined && Number.isFinite(n)).length;
  const result = filledCount === 2 ? solveRightTriangle(parsed) : null;

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 rounded-xl border border-border bg-muted/40 p-8">
      <p className="text-body-sm text-muted-foreground">Enter any two values — the third is solved for you.</p>
      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          Leg a
          <input type="number" value={legA} onChange={(e) => setLegA(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground" />
        </label>
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          Leg b
          <input type="number" value={legB} onChange={(e) => setLegB(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground" />
        </label>
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          Hypotenuse
          <input type="number" value={hypotenuse} onChange={(e) => setHypotenuse(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground" />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-4 rounded-md bg-background py-6 text-center">
        <div>
          <div className="text-caption text-muted-foreground">Leg a</div>
          <div className="text-h4 font-semibold tabular-nums">{result ? result.legA.toFixed(2) : "—"}</div>
        </div>
        <div>
          <div className="text-caption text-muted-foreground">Leg b</div>
          <div className="text-h4 font-semibold tabular-nums">{result ? result.legB.toFixed(2) : "—"}</div>
        </div>
        <div>
          <div className="text-caption text-muted-foreground">Hypotenuse</div>
          <div className="text-h4 font-semibold tabular-nums">{result ? result.hypotenuse.toFixed(2) : "—"}</div>
        </div>
      </div>
      {result && (
        <p className="text-center text-body-sm text-muted-foreground">
          Area: {result.area.toFixed(2)} · Perimeter: {result.perimeter.toFixed(2)}
        </p>
      )}
      {filledCount !== 2 && (
        <p role="status" className="text-center text-body-sm text-warning">
          Fill in exactly two values.
        </p>
      )}
    </div>
  );
}
