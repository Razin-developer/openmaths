"use client";

import { useRef } from "react";
import { cn } from "@openmaths/components/lib/utils";

export function BentoGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-fr", className)}>{children}</div>;
}

interface BentoCardProps {
  title: string;
  description: string;
  className?: string;
  icon?: React.ReactNode;
  /** Landing-rework PRD §4.3: an asymmetric bento needs one cell to visually lead — spans two
   * grid tracks (and two rows on `lg:grid-cols-4`) instead of every cell being equal weight. */
  span?: "1" | "2";
  /** Larger type + an accent-tinted border, for the cell that should read as the flagship. */
  featured?: boolean;
}

const SPAN_CLASS: Record<NonNullable<BentoCardProps["span"]>, string> = {
  "1": "",
  "2": "sm:col-span-2 lg:col-span-2 lg:row-span-2",
};

const SPOTLIGHT_SIZE = 220;

/** A bento cell with a cursor-following "spotlight" hover (PRD §4: "bento grid with hover
 * micro-interactions (tilt/parallax/spotlight)") — a radial gradient positioned via CSS custom
 * properties updated on pointer move, not React state, so the hover doesn't trigger a re-render
 * per mouse-move frame. */
export function BentoCard({ title, description, className, icon, span = "1", featured = false }: BentoCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !ref.current) return;
    ref.current.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={cn(
        "group relative flex overflow-hidden rounded-xl border p-6 transition-colors duration-base",
        featured ? "border-accent-violet-500/40 bg-surface-card-hover" : "border-border-hairline bg-surface-card hover:bg-surface-card-hover",
        SPAN_CLASS[span],
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-base group-hover:opacity-100"
        style={{
          background: `radial-gradient(${SPOTLIGHT_SIZE}px circle at var(--spot-x, 50%) var(--spot-y, 50%), color-mix(in oklch, var(--accent-blue-500) 35%, transparent), transparent)`,
        }}
        aria-hidden
      />
      <div className="relative flex flex-col justify-center gap-3">
        {icon}
        <h3 className={cn("font-semibold", featured ? "text-h3" : "text-h4")}>{title}</h3>
        <p className="text-body-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
