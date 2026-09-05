"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/model", label: "Model" },
  { href: "/settings/skills", label: "Skills" },
  { href: "/settings/usage", label: "Usage" },
  { href: "/settings/insights", label: "Insights" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 flex-col gap-0.5 sm:w-36">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs transition-colors",
              active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
