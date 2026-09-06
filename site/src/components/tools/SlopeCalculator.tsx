"use client";

import { useState } from "react";
import { slopeBetween } from "@/lib/tools/slope";

export function SlopeCalculator() {
  const [x1, setX1] = useState("1");
  const [y1, setY1] = useState("2");
  const [x2, setX2] = useState("4");
  const [y2, setY2] = useState("8");

  const parsed = [x1, y1, x2, y2].map(Number.parseFloat);
  const valid = parsed.every(Number.isFinite);
  const result = valid ? slopeBetween(parsed[0], parsed[1], parsed[2], parsed[3]) : null;

  const fields: [string, string, (v: string) => void][] = [
    ["x₁", x1, setX1],
    ["y₁", y1, setY1],
    ["x₂", x2, setX2],
    ["y₂", y2, setY2],
  ];

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 rounded-xl border border-border-hairline bg-surface-card p-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {fields.map(([label, value, setter]) => (
          <label key={label} className="flex flex-col gap-2 text-body-sm text-muted-foreground">
            {label}
            <input
              type="number"
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="rounded-md border border-border-hairline bg-background px-3 py-2 text-body text-foreground"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1 rounded-md bg-surface-shell py-6" role="status">
        <span className="font-mono-code text-h3 font-semibold tabular-nums">
          {result ? (result.slope === null ? "undefined (vertical)" : result.slope.toFixed(3)) : "—"}
        </span>
        <span className="text-caption text-muted-foreground">slope</span>
        {result && <span className="mt-2 font-mono-code text-body-sm text-muted-foreground">{result.equation}</span>}
      </div>
    </div>
  );
}
