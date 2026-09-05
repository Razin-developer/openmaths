"use client";

import { cn } from "@openmaths/components/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
}

/** A pill segmented control — the reference's tab-strip pattern, generalized so it can gate real
 * content (see `TrustPanel`) rather than being decorative chrome with no function behind it. */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" className="inline-flex flex-wrap items-center justify-center gap-1 rounded-pill border border-border-hairline bg-surface-card p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-pill px-4 py-2 text-body-sm font-medium transition-colors duration-base",
            value === option.value ? "bg-accent-blue-500 text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
