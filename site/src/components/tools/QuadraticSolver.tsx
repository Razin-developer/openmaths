"use client";

import { useState } from "react";
import { solveQuadratic } from "@/lib/tools/quadratic";

export function QuadraticSolver() {
  const [a, setA] = useState("1");
  const [b, setB] = useState("-3");
  const [c, setC] = useState("2");

  const parsedA = Number.parseFloat(a);
  const parsedB = Number.parseFloat(b);
  const parsedC = Number.parseFloat(c);
  const valid = Number.isFinite(parsedA) && Number.isFinite(parsedB) && Number.isFinite(parsedC) && parsedA !== 0;
  const result = valid ? solveQuadratic(parsedA, parsedB, parsedC) : null;

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 rounded-xl border border-border bg-muted/40 p-8">
      <p className="text-center text-body-sm text-muted-foreground">ax&sup2; + bx + c = 0</p>
      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          a
          <input type="number" value={a} onChange={(e) => setA(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground" />
        </label>
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          b
          <input type="number" value={b} onChange={(e) => setB(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground" />
        </label>
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          c
          <input type="number" value={c} onChange={(e) => setC(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground" />
        </label>
      </div>
      {!valid && <p className="text-center text-body-sm text-warning">a cannot be 0 — that would make this linear, not quadratic.</p>}
      {result && (
        <div className="flex flex-col gap-3 rounded-md bg-background py-6 text-center">
          <div>
            <div className="text-caption text-muted-foreground">Roots</div>
            {result.isComplex && result.complexRoots ? (
              <div className="text-h4 font-semibold tabular-nums">
                {result.complexRoots[0].re.toFixed(2)} ± {Math.abs(result.complexRoots[0].im).toFixed(2)}i
              </div>
            ) : (
              <div className="text-h4 font-semibold tabular-nums">
                {result.roots?.map((r) => r.toFixed(2)).join(", ")}
              </div>
            )}
          </div>
          <div className="text-body-sm text-muted-foreground">
            Discriminant: {result.discriminant.toFixed(2)} · Vertex: ({result.vertex.x.toFixed(2)}, {result.vertex.y.toFixed(2)})
          </div>
        </div>
      )}
    </div>
  );
}
