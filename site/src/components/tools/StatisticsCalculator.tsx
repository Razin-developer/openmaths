"use client";

import { useState } from "react";
import { parseNumberList, computeStatistics } from "@/lib/tools/statistics";

export function StatisticsCalculator() {
  const [input, setInput] = useState("4, 8, 6, 5, 3, 8, 9, 8");

  const values = parseNumberList(input);
  const result = computeStatistics(values);

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 rounded-xl border border-border-hairline bg-surface-card p-8">
      <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
        Numbers (comma or space separated)
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          className="rounded-md border border-border-hairline bg-background px-3 py-2 text-body text-foreground"
        />
      </label>
      {result ? (
        <div className="grid grid-cols-2 gap-3" role="status">
          {[
            ["Mean", result.mean.toFixed(2)],
            ["Median", result.median.toFixed(2)],
            ["Mode", result.mode.length ? result.mode.join(", ") : "none"],
            ["Range", result.range.toFixed(2)],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-md bg-surface-shell py-4">
              <span className="font-mono-code text-h4 font-semibold tabular-nums">{value}</span>
              <span className="text-caption text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-body-sm text-muted-foreground" role="status">
          Enter at least one number.
        </p>
      )}
    </div>
  );
}
