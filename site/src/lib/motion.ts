/**
 * Motion tokens (PRD §3/§4) as JS constants — Motion and GSAP configs take numbers/eases
 * directly, not CSS custom properties, so these mirror `globals.css`'s `--duration-*`/`--ease-*`
 * values by hand. Keep both in sync if either changes.
 */
export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
  cinematic: 0.7,
} as const;

export const EASE = {
  standard: [0.2, 0.8, 0.2, 1] as const,
  emphasized: [0.16, 1, 0.3, 1] as const,
};

/** A global stagger unit for sibling reveal animations (PRD §3: "60-80ms"). */
export const STAGGER = 0.07;
