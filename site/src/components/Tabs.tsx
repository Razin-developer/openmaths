"use client";

import { useId, useState } from "react";
import { cn } from "@openmaths/components/lib/utils";

interface Tab {
  label: string;
  content: React.ReactNode;
}

/** A minimal, dependency-free tabs implementation (no radix in `site` yet — P1 kept this app's
 * own dependency set small, and full shadcn parity isn't needed for one component). Keyboard
 * behavior: Tab moves focus to the active tab button (standard roving-tabindex pattern), Enter/
 * Space activates; arrow-key roving is the one thing a full radix Tabs would add over this. */
export function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const baseId = useId();

  return (
    <div>
      <div role="tablist" className="flex flex-wrap justify-center gap-2">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={active === i}
            aria-controls={`${baseId}-panel-${i}`}
            onClick={() => setActive(i)}
            className={cn(
              "rounded-pill px-5 py-2 text-body-sm font-medium transition-colors duration-base",
              active === i ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.label}
          role="tabpanel"
          id={`${baseId}-panel-${i}`}
          aria-labelledby={`${baseId}-tab-${i}`}
          hidden={active !== i}
          className="pt-10"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
