"use client";

import { useState } from "react";
import {
  LENGTH_UNITS,
  WEIGHT_UNITS,
  TEMPERATURE_UNITS,
  convertLength,
  convertWeight,
  convertTemperature,
  type LengthUnit,
  type WeightUnit,
  type TemperatureUnit,
  type UnitCategory,
} from "@/lib/tools/unitConvert";

const CATEGORIES: { id: UnitCategory; label: string; units: readonly string[] }[] = [
  { id: "length", label: "Length", units: Object.keys(LENGTH_UNITS) },
  { id: "weight", label: "Weight", units: Object.keys(WEIGHT_UNITS) },
  { id: "temperature", label: "Temperature", units: TEMPERATURE_UNITS },
];

export function UnitConverter() {
  const [category, setCategory] = useState<UnitCategory>("length");
  const units = CATEGORIES.find((c) => c.id === category)!.units;
  const [from, setFrom] = useState(units[0]);
  const [to, setTo] = useState(units[1]);
  const [value, setValue] = useState("1");

  function handleCategoryChange(next: UnitCategory) {
    setCategory(next);
    const nextUnits = CATEGORIES.find((c) => c.id === next)!.units;
    setFrom(nextUnits[0]);
    setTo(nextUnits[1]);
  }

  const parsedValue = Number.parseFloat(value);
  const valid = Number.isFinite(parsedValue);
  let result: number | null = null;
  if (valid) {
    if (category === "length") result = convertLength(parsedValue, from as LengthUnit, to as LengthUnit);
    else if (category === "weight") result = convertWeight(parsedValue, from as WeightUnit, to as WeightUnit);
    else result = convertTemperature(parsedValue, from as TemperatureUnit, to as TemperatureUnit);
  }

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 rounded-xl border border-border bg-muted/40 p-8">
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => handleCategoryChange(c.id)}
            className={`rounded-pill px-4 py-2 text-body-sm font-medium transition-colors duration-base ${category === c.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-2 text-body-sm text-muted-foreground">
          Value
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground" />
        </label>
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          From
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground">
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
          To
          <select value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground">
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-md bg-background py-6">
        <span className="text-h2 font-semibold tabular-nums">{result !== null ? result.toFixed(4) : "—"}</span>
        <span className="text-caption text-muted-foreground">{to}</span>
      </div>
    </div>
  );
}
