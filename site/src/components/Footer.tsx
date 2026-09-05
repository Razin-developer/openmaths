import Link from "next/link";

const LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/resources", label: "Resources" },
  { href: "/help", label: "Help Center" },
  { href: "/changelog", label: "Changelog" },
  { href: "/faq", label: "FAQ" },
];

/**
 * A real content-links column now that those pages exist (P4) — still not the PRD's full "fat
 * footer" (§5.1: product/company/legal/social/newsletter columns too), since those pages are P5
 * scope, not built yet.
 */
export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-6 py-12 sm:flex-row sm:justify-between">
        <p className="text-body-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} openmaths.
          <br />
          AI-drawn, step-by-step math.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm text-muted-foreground">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
