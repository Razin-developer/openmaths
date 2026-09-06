import { Check, Minus } from "lucide-react";
import { cn } from "@openmaths/components/lib/utils";

type Cell = boolean | string;

interface ComparisonRow {
  feature: string;
  values: [Cell, Cell, Cell];
}

const COLUMNS = ["Starter", "Pro Researcher", "Lab · Institution"] as const;

const ROWS: ComparisonRow[] = [
  { feature: "Canvases", values: ["Unlimited", "Unlimited", "Unlimited"] },
  { feature: "Answer forms (steps, diagrams, tables, plots)", values: [true, true, true] },
  { feature: "Monthly generation limit", values: ["Standard", "Higher", "Custom"] },
  { feature: "Voice narration", values: [false, true, true] },
  { feature: "Video export", values: [false, true, true] },
  { feature: "Priority support", values: [false, true, true] },
  { feature: "Classroom / roster management", values: [false, false, true] },
  { feature: "Shared canvases for a whole class", values: [false, false, true] },
  { feature: "Volume pricing", values: [false, false, true] },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto size-4 text-accent-emerald-500" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Not included" />;
  return <span className="text-body-sm text-muted-foreground">{value}</span>;
}

/** Landing-rework PRD §6.6: the detailed feature comparison below the tier cards, for anyone who
 * wants the specifics rather than just the headline feature list on each card. */
export function PricingComparison() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-center">
        <thead>
          <tr className="border-b border-border-hairline">
            <th className="py-4 text-left text-body-sm font-medium text-muted-foreground">Feature</th>
            {COLUMNS.map((col, i) => (
              <th key={col} className={cn("py-4 text-body-sm font-semibold", i === 1 && "text-accent-violet-600")}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.feature} className="border-b border-border-hairline last:border-0">
              <td className="py-3 text-left text-body-sm text-foreground">{row.feature}</td>
              {row.values.map((value, i) => (
                <td key={i} className="py-3">
                  <CellValue value={value} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
