"use client";

import { useState } from "react";
import { computeFraction, type FractionOp } from "@/lib/tools/fraction";

const OPS: { id: FractionOp; symbol: string }[] = [
  { id: "add", symbol: "+" },
  { id: "subtract", symbol: "−" },
  { id: "multiply", symbol: "×" },
  { id: "divide", symbol: "÷" },
];

function NumInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-16 rounded-md border border-border bg-background px-2 py-2 text-center text-body text-foreground"
    />
  );
}

export function FractionCalculator() {
  const [aNum, setANum] = useState("1");
  const [aDen, setADen] = useState("2");
  const [bNum, setBNum] = useState("1");
  const [bDen, setBDen] = useState("3");
  const [op, setOp] = useState<FractionOp>("add");

  const a = { numerator: Number.parseInt(aNum, 10), denominator: Number.parseInt(aDen, 10) };
  const b = { numerator: Number.parseInt(bNum, 10), denominator: Number.parseInt(bDen, 10) };
  const valid = [a.numerator, a.denominator, b.numerator, b.denominator].every(Number.isFinite);
  const result = valid ? computeFraction(a, b, op) : null;

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 rounded-xl border border-border bg-muted/40 p-8">
      <div className="flex flex-wrap justify-center gap-2">
        {OPS.map((o) => (
          <button
            key={o.id}
            onClick={() => setOp(o.id)}
            className={`size-10 rounded-pill text-body font-medium transition-colors duration-base ${op === o.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {o.symbol}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <NumInput value={aNum} onChange={setANum} />
          <div className="h-px w-16 bg-border" />
          <NumInput value={aDen} onChange={setADen} />
        </div>
        <span className="text-h3 text-muted-foreground">{OPS.find((o) => o.id === op)?.symbol}</span>
        <div className="flex flex-col items-center gap-2">
          <NumInput value={bNum} onChange={setBNum} />
          <div className="h-px w-16 bg-border" />
          <NumInput value={bDen} onChange={setBDen} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-md bg-background py-6">
        <span className="text-caption text-muted-foreground">Result</span>
        {result ? (
          <span className="text-h2 font-semibold tabular-nums">
            {result.numerator}/{result.denominator}
          </span>
        ) : (
          <span className="text-h2 font-semibold text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
