import Link from "next/link";

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/product", label: "Product" },
      { href: "/pricing", label: "Pricing" },
      { href: "/tools", label: "Free tools" },
    ],
  },
  {
    heading: "Content",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/resources", label: "Resources" },
      { href: "/help", label: "Help Center" },
      { href: "/changelog", label: "Changelog" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/reviews", label: "Reviews" },
      { href: "/community", label: "Community" },
      { href: "/contact", label: "Contact" },
      { href: "/feedback", label: "Feedback" },
      { href: "/report-bug", label: "Report a bug" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/cookies", label: "Cookies" },
      { href: "/security", label: "Security" },
      { href: "/acceptable-use", label: "Acceptable Use" },
      { href: "/dpa", label: "DPA" },
    ],
  },
];

/** The full "fat footer" (PRD §5.1) — every column now points at a real page, per this session's
 * own established pattern of adding footer links only once the page they point to actually
 * exists (P2 through P5 each added their own column/links as their pages shipped). */
export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto grid max-w-[1320px] grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
        {COLUMNS.map((column) => (
          <nav key={column.heading} className="flex flex-col gap-3">
            <h3 className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">{column.heading}</h3>
            {column.links.map((link) => (
              <Link key={link.href} href={link.href} className="text-body-sm text-muted-foreground transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="mx-auto max-w-[1320px] border-t border-border/60 px-6 py-6 text-body-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} openmaths. AI-drawn, step-by-step math.
      </div>
    </footer>
  );
}
