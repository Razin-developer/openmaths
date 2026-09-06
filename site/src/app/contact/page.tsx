import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the openmaths team.",
  alternates: { canonical: "https://openmaths.com/contact" },
};

export default function ContactPage() {
  return (
    <Section className="text-center">
      <Reveal>
        <h1 className="text-display-xl font-semibold text-balance">Contact us</h1>
      </Reveal>
      <Reveal index={1}>
        <p className="mx-auto mt-4 max-w-[50ch] text-body-lg text-muted-foreground">
          Questions about pricing, education plans, or anything else — we read every message.
        </p>
      </Reveal>
      <Reveal index={2} className="mt-10">
        <ContactForm type="CONTACT" messagePlaceholder="What can we help with?" />
      </Reveal>
    </Section>
  );
}
