"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { NotificationBell } from "@/components/board/NotificationBell";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
];

const AUTH_ROUTES = new Set(["/login", "/signup"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCanvas = pathname === "/" || pathname.startsWith("/canvas");

  // Canvas pages own their entire viewport (custom top-left bar, right sidebar, dock) — no
  // global header, same as the auth routes.
  if (AUTH_ROUTES.has(pathname)) {
    return <main className="h-screen">{children}</main>;
  }

  if (isCanvas) {
    return (
      <main className="h-screen">
        {children}
        <CommandPalette />
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-[13px] font-medium tracking-tight">
            openmaths
          </Link>
          <nav className="flex items-center gap-4">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-xs transition-colors",
                    active
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-0.5">
          <NotificationBell />
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
      <CommandPalette />
    </div>
  );
}
