"use client";

import { useState } from "react";
import { percentOf, whatPercent, percentChange } from "@/lib/tools/percentage";

type Mode = "of" | "what" | "change";

const MODES: { id: Mode; label: string }[] = [
  { id: "of", label: "X% of Y" },
  { id: "what", label: "X is what % of Y" },
  { id: "change", label: "% change" },
];

export function PercentageCalculator() {
  const [mode, setMode] = useState<Mode>("of");
  const [x, setX] = useState("20");
  const [y, setY] = useState("80");

  const parsedX = Number.parseFloat(x);
  const parsedY = Number.parseFloat(y);
  const valid = Number.isFinite(parsedX) && Number.isFinite(parsedY);

  let result: number | null = null;
  let suffix = "";
  if (valid) {
    if (mode === "of") {
      result = percentOf(parsedX, parsedY);
    } else if (mode === "what") {
      result = whatPercent(parsedX, parsedY);
      suffix = "%";
    } else {
      result = percentChange(parsedX, parsedY);
      suffix = "%";
    }
  }

  const labels: Record<Mode, [string, string]> = {
    of: ["Percent", "Of"],
    what: ["X", "Of (Y)"],
    change: ["From", "To"],
  };

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 rounded-xl border border-border bg-muted/40 p-8">
      <div className="flex flex-wrap justify-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-pill px-4 py-2 text-body-sm font-medium transition-colors duration-base ${mode === m.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          {labels[mode][0]}
          <input type="number" value={x} onChange={(e) => setX(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground" />
        </label>
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          {labels[mode][1]}
          <input type="number" value={y} onChange={(e) => setY(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground" />
        </label>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-md bg-background py-6">
        <span className="text-h2 font-semibold tabular-nums">{result !== null ? `${result.toFixed(2)}${suffix}` : "—"}</span>
      </div>
    </div>
  );
}
