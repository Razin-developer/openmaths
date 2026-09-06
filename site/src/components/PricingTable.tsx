"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "./Button";
import { SegmentedToggle } from "./SegmentedToggle";
import { cn } from "@openmaths/components/lib/utils";

export interface PricingTier {
  name: string;
  /** Monthly price in whole dollars when the tier has a billing cycle (omit for Free/Custom). */
  priceMonthly?: number;
  /** Effective monthly price when billed annually (§6.6: "Save 25%"). */
  priceAnnualMonthly?: number;
  /** Fixed display price for tiers with no billing cycle, e.g. "$0" or "Custom". */
  price?: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}

/** Landing-rework PRD §6.6: a Monthly/Annual toggle (only rendered when at least one tier has a
 * billing cycle) plus a featured, violet-elevated tier — replacing the prior static 3-card grid
 * with no toggle and no visual hierarchy. */
export function PricingTable({ tiers }: { tiers: PricingTier[] }) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const hasBillingCycle = tiers.some((tier) => tier.priceMonthly !== undefined);

  return (
    <div className="flex flex-col items-center gap-10">
      {hasBillingCycle && (
        <div className="flex items-center gap-3">
          <SegmentedToggle
            options={[
              { value: "monthly" as const, label: "Monthly" },
              { value: "annual" as const, label: "Annual" },
            ]}
            value={billing}
            onChange={setBilling}
          />
          <span
            className={cn(
              "rounded-pill px-3 py-1 text-caption font-medium transition-opacity",
              billing === "annual" ? "bg-accent-violet-500/15 text-accent-violet-600 opacity-100" : "opacity-0"
            )}
          >
            Save 25%
          </span>
        </div>
      )}
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
        {tiers.map((tier) => {
          const displayPrice = tier.price ?? `$${billing === "annual" ? tier.priceAnnualMonthly : tier.priceMonthly}`;
          return (
            <div
              key={tier.name}
              className={cn(
                "flex flex-col gap-6 rounded-xl border p-8 transition-transform duration-base",
                tier.highlighted
                  ? "border-accent-violet-500 bg-surface-card shadow-[0_0_0_1px_var(--accent-violet-500)] md:scale-105"
                  : "border-border-hairline bg-surface-card"
              )}
            >
              {tier.highlighted && (
                <span className="self-start rounded-pill bg-accent-violet-500 px-3 py-1 text-caption font-medium text-white">Most Popular</span>
              )}
              <div className="flex flex-col gap-2">
                <h3 className="text-h4 font-semibold">{tier.name}</h3>
                <p className="text-body-sm text-muted-foreground">{tier.description}</p>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono-code text-h1 font-semibold tabular-nums">{displayPrice}</span>
                  {tier.priceMonthly !== undefined && <span className="text-body-sm text-muted-foreground">/mo</span>}
                </div>
                {tier.priceMonthly !== undefined && billing === "annual" && (
                  <p className="mt-1 text-caption text-muted-foreground">Billed annually</p>
                )}
              </div>
              <ul className="flex flex-col gap-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-body-sm">
                    <Check className={cn("mt-0.5 size-4 shrink-0", tier.highlighted ? "text-accent-violet-500" : "text-accent")} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                href={tier.href}
                variant={tier.highlighted ? "primary" : "secondary"}
                className={cn("mt-auto", tier.highlighted && "!bg-accent-violet-500 hover:!opacity-90")}
                ctaId={`pricing-${tier.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                {tier.cta}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
