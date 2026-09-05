"use client";

import { useRef } from "react";
import { cn } from "@openmaths/components/lib/utils";

export function BentoGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>{children}</div>;
}

interface BentoCardProps {
  title: string;
  description: string;
  className?: string;
  icon?: React.ReactNode;
}

const SPOTLIGHT_SIZE = 220;

/** A bento cell with a cursor-following "spotlight" hover (PRD §4: "bento grid with hover
 * micro-interactions (tilt/parallax/spotlight)") — a radial gradient positioned via CSS custom
 * properties updated on pointer move, not React state, so the hover doesn't trigger a re-render
 * per mouse-move frame. */
export function BentoCard({ title, description, className, icon }: BentoCardProps) {
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
        "group relative overflow-hidden rounded-xl border border-border bg-muted/40 p-6",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-base group-hover:opacity-100"
        style={{
          background: `radial-gradient(${SPOTLIGHT_SIZE}px circle at var(--spot-x, 50%) var(--spot-y, 50%), var(--accent-100), transparent)`,
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-3">
        {icon}
        <h3 className="text-h4 font-semibold">{title}</h3>
        <p className="text-body-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
