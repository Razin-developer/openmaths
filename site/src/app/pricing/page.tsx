import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { PricingTable, type PricingTier } from "@/components/PricingTable";
import { CTABand } from "@/components/CTABand";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free / Pro / Education tiers for openmaths — the AI math tutor that draws and narrates every step.",
};

const TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    description: "For getting started.",
    features: ["Unlimited canvases", "Step-by-step answers with diagrams", "Community support"],
    cta: "Start free",
    href: "http://localhost:3000",
  },
  {
    name: "Pro",
    price: "$12",
    period: "mo",
    description: "For regular use.",
    features: ["Everything in Free", "Voice narration & video export", "Higher generation limits", "Priority support"],
    cta: "Start Pro trial",
    href: "http://localhost:3000",
    highlighted: true,
  },
  {
    name: "Education",
    price: "Contact us",
    description: "For classrooms and schools.",
    features: ["Everything in Pro", "Classroom/roster management", "Shared canvases for a whole class", "Volume pricing"],
    cta: "Talk to us",
    // Placeholder — /contact is P5 scope (Trust & company pages); a mailto avoids a dead internal
    // link in the meantime. Swap for the real contact form once it exists.
    href: "mailto:hello@openmaths.dev",
  },
];

const FAQ = [
  { q: "Is there a free tier?", a: "Yes — Free includes unlimited canvases and every answer form (steps, diagrams, tables, plots), just with lower monthly generation limits than Pro." },
  { q: "Can I cancel anytime?", a: "Yes, Pro is month-to-month with no lock-in." },
  { q: "Do you offer student discounts?", a: "Education pricing covers classrooms and schools — reach out and we'll work out a rate for your situation." },
];

/**
 * Pricing figures above are placeholders (PRD §5.3's own scope for this page — real tiers/prices
 * aren't decided yet), structured exactly like real ones so the layout is real and swapping in
 * final numbers later is a content change, not a rebuild.
 */
export default function PricingPage() {
  return (
    <>
      <Section className="text-center">
        <Reveal>
          <h1 className="text-display-xl font-semibold text-balance">Simple pricing</h1>
        </Reveal>
        <Reveal index={1}>
          <p className="mx-auto mt-4 max-w-[50ch] text-body-lg text-muted-foreground">
            Start free. Upgrade when you want narration, video export, and higher limits.
          </p>
        </Reveal>
      </Section>

      <Section width="wide">
        <Reveal>
          <PricingTable tiers={TIERS} />
        </Reveal>
      </Section>

      <Section>
        <Reveal className="mb-10 text-center">
          <h2 className="text-h2 font-semibold">Pricing FAQ</h2>
        </Reveal>
        <div className="mx-auto flex max-w-[70ch] flex-col divide-y divide-border">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} index={i} className="flex flex-col gap-2 py-6">
              <h3 className="text-h4 font-semibold">{item.q}</h3>
              <p className="text-body text-muted-foreground">{item.a}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <Reveal>
          <CTABand title="Try openmaths free — no card required." />
        </Reveal>
      </Section>
    </>
  );
}
