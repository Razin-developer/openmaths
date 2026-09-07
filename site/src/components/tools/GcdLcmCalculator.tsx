"use client";

import { useState } from "react";
import { computeGcdLcm } from "@/lib/tools/gcdLcm";

function isPositiveInteger(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

export function GcdLcmCalculator() {
  const [a, setA] = useState("12");
  const [b, setB] = useState("18");

  const parsedA = Number.parseInt(a, 10);
  const parsedB = Number.parseInt(b, 10);
  const valid = isPositiveInteger(parsedA) && isPositiveInteger(parsedB);
  const result = valid ? computeGcdLcm(parsedA, parsedB) : null;

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 rounded-xl border border-border-hairline bg-surface-card p-8">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          First number
          <input
            type="number"
            min="1"
            step="1"
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="rounded-md border border-border-hairline bg-background px-3 py-2 text-body text-foreground"
          />
        </label>
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          Second number
          <input
            type="number"
            min="1"
            step="1"
            value={b}
            onChange={(e) => setB(e.target.value)}
            className="rounded-md border border-border-hairline bg-background px-3 py-2 text-body text-foreground"
          />
        </label>
      </div>
      {result ? (
        <div className="grid grid-cols-2 gap-3" role="status">
          <div className="flex flex-col items-center gap-1 rounded-md bg-surface-shell py-5">
            <span className="font-mono-code text-h3 font-semibold tabular-nums">{result.gcd}</span>
            <span className="text-caption text-muted-foreground">GCD</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md bg-surface-shell py-5">
            <span className="font-mono-code text-h3 font-semibold tabular-nums">{result.lcm}</span>
            <span className="text-caption text-muted-foreground">LCM</span>
          </div>
        </div>
      ) : (
        <p className="text-center text-body-sm text-muted-foreground" role="status">
          Enter two positive whole numbers.
        </p>
      )}
    </div>
  );
}
