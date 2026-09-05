import Link from "next/link";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Structural nav only (PRD P1 scope) — sticky, logo, theme toggle, "Open app" CTA. The mega-menu
 * for Product/Tools/Resources (PRD §5.1) links to pages that don't exist yet; real nav links are
 * added as each page ships in P2+, rather than shipping dead links now.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6">
        <Link href="/" className="text-h4 font-semibold tracking-tight">
          openmaths
        </Link>
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
