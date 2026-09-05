import { cn } from "@openmaths/components/lib/utils";

/**
 * The repeated "inset gradient card with a bottom glow" hero/CTA-band container — the single most
 * recognizable shape in the reference layout this section structure is modeled on (rounded corners,
 * full-bleed color card, centered content, a soft radial glow pooling at the bottom edge). Colors
 * and copy are ours: the gradient is `--gradient-reasoning` (our blue→violet accent pair, not the
 * reference's orange), and every word inside is written fresh for `page.tsx` — only the shape,
 * spacing, and glow treatment are borrowed.
 */
export function GlowBand({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("relative isolate overflow-hidden rounded-[2rem] px-6 py-20 text-center text-white sm:px-12 sm:py-28", className)}
      style={{ background: "var(--gradient-reasoning)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
        style={{ background: "radial-gradient(60% 100% at 50% 100%, rgba(255,255,255,0.4), transparent)" }}
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-[720px] flex-col items-center gap-6">{children}</div>
    </div>
  );
}
