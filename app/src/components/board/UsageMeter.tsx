"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUsageMeterStore } from "@/store/usageMeterStore";
import { api } from "@openmaths/api-client";

const POLL_INTERVAL_MS = 30_000;

interface BudgetStatus {
  spentUsd: number;
  budgetUsd: number;
  remainingUsd: number;
  status: "ok" | "warn" | "hard-stop";
  estimated: boolean;
}

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Always-available "how much AI budget is left this month" readout (PRD "User System — Usage
 * Metering & Notifications" §4.4's live in-session meter) — near-real-time via `useUsageMeterStore`
 * (bumped right after a generation's `done` event) plus a background poll as a fallback. */
export function UsageMeter() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const version = useUsageMeterStore((s) => s.version);

  useEffect(() => {
    let cancelled = false;
    function load() {
      api.usage
        .budget()
        .then((data) => {
          if (!cancelled && data?.budget) setBudget(data.budget as BudgetStatus);
        })
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [version]);

  if (!budget) return null;

  const label =
    budget.status === "hard-stop"
      ? "Monthly AI budget used up"
      : budget.status === "warn"
        ? "Approaching your monthly AI budget"
        : "Monthly AI usage";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            // h-7 matches the icon-sm buttons (Notifications/Share/ThemeToggle) it sits next to
            // in the topbar pill, so every item reads at the same height (user ask).
            "flex h-7 items-center gap-1 rounded-full border border-border bg-background px-2.5 text-[10.5px] tabular-nums text-muted-foreground",
            budget.status === "warn" && "border-amber-500/50 text-amber-600 dark:text-amber-400",
            budget.status === "hard-stop" && "border-destructive/50 text-destructive"
          )}
        >
          <Gauge className="size-3" />
          {formatUsd(budget.spentUsd)} / {formatUsd(budget.budgetUsd)}
          {budget.estimated && "≈"}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label} — {formatUsd(budget.remainingUsd)} remaining this month
      </TooltipContent>
    </Tooltip>
  );
}
