import { Check } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@openmaths/components/lib/utils";

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}

export function PricingTable({ tiers }: { tiers: PricingTier[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {tiers.map((tier) => (
        <div
          key={tier.name}
          className={cn(
            "flex flex-col gap-6 rounded-xl border p-8",
            tier.highlighted ? "border-accent bg-accent-100/40" : "border-border bg-muted/40"
          )}
        >
          <div className="flex flex-col gap-2">
            <h3 className="text-h4 font-semibold">{tier.name}</h3>
            <p className="text-body-sm text-muted-foreground">{tier.description}</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-h1 font-semibold tabular-nums">{tier.price}</span>
            {tier.period && <span className="text-body-sm text-muted-foreground">/{tier.period}</span>}
          </div>
          <ul className="flex flex-col gap-3">
            {tier.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-body-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button href={tier.href} variant={tier.highlighted ? "primary" : "secondary"} className="mt-auto">
            {tier.cta}
          </Button>
        </div>
      ))}
    </div>
  );
}
