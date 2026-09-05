"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@openmaths/components/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps {
  children: React.ReactNode;
  href?: string;
  variant?: Variant;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  secondary: "bg-muted text-foreground hover:bg-border",
  ghost: "text-foreground hover:bg-muted",
};

const MAGNETIC_STRENGTH = 0.25;

/** Primary/secondary/ghost per PRD §3; a subtle "magnetic" pull toward the cursor on hover (§4's
 * named "magnetic buttons... used sparingly" pattern) — skipped under reduced motion, since the
 * effect is pure delight with no comprehension value. */
export function Button({ children, href, variant = "primary", className, onClick, type = "button" }: ButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * MAGNETIC_STRENGTH;
    const y = (e.clientY - rect.top - rect.height / 2) * MAGNETIC_STRENGTH;
    ref.current.style.transform = `translate(${x}px, ${y}px)`;
  }

  function handleMouseLeave() {
    if (ref.current) ref.current.style.transform = "translate(0, 0)";
  }

  const classes = cn(
    "inline-flex items-center justify-center rounded-pill px-6 py-3 text-body-sm font-medium transition-colors duration-base",
    VARIANT_CLASS[variant],
    className
  );

  const content = (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
    >
      {href ? (
        <Link href={href} className={classes}>
          {children}
        </Link>
      ) : (
        <button type={type} onClick={onClick} className={classes}>
          {children}
        </button>
      )}
    </motion.div>
  );

  return content;
}
