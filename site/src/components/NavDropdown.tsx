"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@openmaths/components/lib/utils";

interface DropdownItem {
  href: string;
  label: string;
  description?: string;
}

/**
 * Landing-rework PRD §6.11: the nav mega-menu that was waiting on Tools/Resources/Blog/Help/FAQ
 * actually existing — they all do now. A minimal, dependency-free dropdown (matching this
 * codebase's own `Tabs.tsx` precedent rather than pulling in radix for one component): click to
 * open, Escape or an outside click closes, keyboard-reachable via a real `<button>`.
 */
export function NavDropdown({ label, items }: { label: string; items: DropdownItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 transition-colors hover:text-foreground"
      >
        {label}
        <ChevronDown className={cn("size-3.5 transition-transform duration-base", open && "rotate-180")} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute left-1/2 top-full z-50 mt-3 w-64 -translate-x-1/2 rounded-xl border border-border-hairline bg-surface-card p-2 shadow-lg"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-card-hover"
            >
              <span className="text-body-sm font-medium text-foreground">{item.label}</span>
              {item.description && <span className="text-caption text-muted-foreground">{item.description}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
