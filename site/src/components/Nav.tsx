import Link from "next/link";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Structural nav (PRD P1 scope), with real links added as pages actually ship (P2 added Product
 * and Pricing) — the full mega-menu for Tools/Resources/etc. (PRD §5.1) still waits on those
 * sections existing, rather than shipping dead links now.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
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
          <Button href={APP_URL} variant="primary" className="text-caption">
            Open app
          </Button>
        </div>
      </div>
    </header>
  );
}
