export type UnitCategory = "length" | "weight" | "temperature";

/** Factors are relative to the category's base unit (meters, kilograms). Temperature is handled
 * separately since °C/°F/K aren't a simple multiplicative ratio (there's an offset). */
export const LENGTH_UNITS = { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 } as const;
export const WEIGHT_UNITS = { mg: 0.000001, g: 0.001, kg: 1, lb: 0.453592, oz: 0.0283495 } as const;
export const TEMPERATURE_UNITS = ["C", "F", "K"] as const;

export type LengthUnit = keyof typeof LENGTH_UNITS;
export type WeightUnit = keyof typeof WEIGHT_UNITS;
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  return (value * LENGTH_UNITS[from]) / LENGTH_UNITS[to];
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  return (value * WEIGHT_UNITS[from]) / WEIGHT_UNITS[to];
}

export function convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
  if (from === to) return value;
  // Normalize to Celsius first, then to the target — simpler than 6 direct pairwise formulas.
  const celsius = from === "C" ? value : from === "F" ? ((value - 32) * 5) / 9 : value - 273.15;
  if (to === "C") return celsius;
  if (to === "F") return (celsius * 9) / 5 + 32;
  return celsius + 273.15;
}
