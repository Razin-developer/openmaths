"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { SegmentedToggle } from "./SegmentedToggle";
import type { Testimonial } from "./TestimonialCard";

interface FormTab {
  id: string;
  label: string;
  testimonial: Testimonial;
}

/**
 * The reference's bordered "browser chrome" trust card — a tab strip up top, one large quote
 * below. Ours gates real content instead of being static chrome: switching the tab actually swaps
 * which (flagged-placeholder, see `placeholder-content.ts`) testimonial is shown, grouped by who
 * gave it, so the toggle is a genuine affordance rather than a non-functional visual borrowed from
 * the reference.
 */
export function TrustPanel({ tabs }: { tabs: FormTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border-hairline bg-surface-card">
      <div className="flex items-center justify-center border-b border-border-hairline bg-surface-shell px-4 py-3">
        <SegmentedToggle options={tabs.map((tab) => ({ value: tab.id, label: tab.label }))} value={active} onChange={setActive} />
      </div>
      <div className="flex flex-col items-center gap-4 px-8 py-14 text-center">
        <div className="flex gap-0.5 text-warning" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-4" fill="currentColor" strokeWidth={0} />
          ))}
        </div>
        <p className="max-w-[60ch] text-h4 font-medium text-balance">&ldquo;{current.testimonial.quote}&rdquo;</p>
        <div className="text-body-sm text-muted-foreground">
          <span className="font-medium text-foreground">{current.testimonial.name}</span> — {current.testimonial.role}
        </div>
      </div>
    </div>
  );
}
