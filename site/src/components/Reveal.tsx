"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger index — multiplied by the global stagger unit for sibling reveals in sequence. */
  index?: number;
  as?: "div" | "section" | "li";
}

const variants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Scroll-triggered reveal (PRD §4 signature pattern: "fade/slide/scale-in with stagger, on every
 * section"). Honors `prefers-reduced-motion` by rendering the visible state outright with no
 * animation — required by §4's motion discipline, not optional polish.
 */
export function Reveal({ children, className, index = 0, as = "div" }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as];

  if (reduceMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
      transition={{ duration: DURATION.slow, ease: EASE.emphasized, delay: index * 0.07 }}
    >
      {children}
    </MotionTag>
  );
}
