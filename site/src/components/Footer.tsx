/**
 * Structural footer only (PRD P1 scope) — the "fat footer" with product/tools/resources/company/
 * legal/social/newsletter columns (PRD §5.1) needs those pages to exist first; this ships the
 * frame (copyright, minimal links) rather than a grid of dead links.
 */
export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-[1320px] flex-col items-center gap-4 px-6 py-12 text-body-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>&copy; {new Date().getFullYear()} openmaths.</p>
        <p>AI-drawn, step-by-step math.</p>
      </div>
    </footer>
  );
}
