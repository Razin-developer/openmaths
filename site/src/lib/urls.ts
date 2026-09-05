/**
 * Single source for the app origin every marketing-site CTA should resolve through (PRD
 * landing-rework §4.7/§0 constraint 5) — `Nav.tsx` already did this ad hoc; everything else
 * (`page.tsx`, `CTABand.tsx`, `pricing/page.tsx`) had it hardcoded to `http://localhost:3000`.
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
