"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@openmaths/components/lib/utils";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";
import { APP_URL } from "@/lib/urls";

const SCROLL_THRESHOLD = 500;

/**
 * Structural nav (PRD P1 scope), with real links added as pages actually ship (P2 added Product
 * and Pricing) — the full mega-menu for Tools/Resources/etc. (PRD §5.1) still waits on those
 * sections existing, rather than shipping dead links now.
 *
 * Landing-rework PRD §4.2: past ~500px of scroll the header tightens into a glass conversion bar
 * and reveals a prominent "Start free" CTA that stays hidden at the top so it doesn't compete
 * with the hero's own primary CTA. Scroll position is read via one rAF-throttled listener and
 * flipped into a single boolean state — not per-scroll state thrash — so the transition can't
 * jank the main thread.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > SCROLL_THRESHOLD);
        ticking.current = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-base",
        scrolled
          ? "border-border-hairline bg-glass-bg shadow-sm backdrop-blur-[var(--glass-blur)]"
          : "border-border/60 bg-background/80 backdrop-blur"
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6">
        <Link href="/" className="text-h4 font-semibold tracking-tight">
          openmaths
        </Link>
        <nav className="hidden items-center gap-6 text-body-sm text-muted-foreground sm:flex">
          <Link href="/product" className="transition-colors hover:text-foreground">
            Product
          </Link>
          <Link href="/tools" className="transition-colors hover:text-foreground">
            Tools
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div
            className={cn(
              "overflow-hidden transition-[max-width,opacity] duration-base",
              scrolled ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0 sm:max-w-0"
            )}
            aria-hidden={!scrolled}
          >
            <Button href={APP_URL} variant="primary" className="text-caption whitespace-nowrap" ctaId="nav-scrolled-start-free">
              Start free
            </Button>
          </div>
          <Button
            href={APP_URL}
            variant={scrolled ? "secondary" : "primary"}
            className="text-caption whitespace-nowrap"
            ctaId="nav-open-app"
          >
            Open app
          </Button>
        </div>
      </div>
    </header>
  );
}
