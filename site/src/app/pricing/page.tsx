import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { PricingTable, type PricingTier } from "@/components/PricingTable";
import { PricingComparison } from "@/components/PricingComparison";
import { CTABand } from "@/components/CTABand";
import { APP_URL } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Starter, Pro Researcher, and Lab · Institution tiers for openmaths — the AI math tutor that draws and narrates every step.",
};

// TODO(razin): Pro Researcher's $16/$12 figures and the 25% annual discount are provisional —
// confirm before launch (Landing-rework PRD §6.6, open question #2).
const TIERS: PricingTier[] = [
  {
    name: "Starter",
    price: "$0",
    description: "For getting started.",
    features: ["Unlimited canvases", "Step-by-step answers with diagrams", "Community support"],
    cta: "Start free",
    href: APP_URL,
  },
  {
    name: "Pro Researcher",
    priceMonthly: 16,
    priceAnnualMonthly: 12,
    description: "For regular use.",
    features: ["Everything in Starter", "Voice narration & video export", "Higher generation limits", "Priority support"],
    cta: "Start Pro trial",
    href: APP_URL,
    highlighted: true,
  },
  {
    name: "Lab · Institution",
    price: "Custom",
    description: "For classrooms and research labs.",
    features: ["Everything in Pro Researcher", "Classroom/roster management", "Shared canvases for a whole class", "Volume pricing"],
    cta: "Talk to us",
    href: "/contact",
  },
];

const FAQ = [
  { q: "Is there a free tier?", a: "Yes — Starter includes unlimited canvases and every answer form (steps, diagrams, tables, plots), just with lower monthly generation limits than Pro Researcher." },
  { q: "Can I cancel anytime?", a: "Yes, Pro Researcher is month-to-month with no lock-in — switch to annual billing whenever you're ready for the discount." },
  { q: "Do you offer classroom or institution pricing?", a: "Lab · Institution covers classrooms and research labs — reach out and we'll work out a rate for your situation." },
];

/**
 * Pricing figures above are provisional (flagged inline, PRD §6.6 open question #2), structured
 * exactly like real ones so the layout is real and swapping in final numbers later is a content
 * change, not a rebuild.
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

      <Section width="wide">
        <Reveal className="mb-8 text-center">
          <h2 className="text-h3 font-semibold">Compare plans in detail</h2>
        </Reveal>
        <Reveal index={1}>
          <PricingComparison />
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
