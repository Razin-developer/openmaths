import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Tell us what's working, what isn't, and what you'd like to see next.",
  alternates: { canonical: "https://openmaths.com/feedback" },
};

export default function FeedbackPage() {
  return (
    <Section className="text-center">
      <Reveal>
        <h1 className="text-display-xl font-semibold text-balance">Feedback & feature requests</h1>
      </Reveal>
      <Reveal index={1}>
        <p className="mx-auto mt-4 max-w-[50ch] text-body-lg text-muted-foreground">
          Tell us what&rsquo;s working, what isn&rsquo;t, and what you&rsquo;d like to see next.
        </p>
      </Reveal>
      <Reveal index={2} className="mt-10">
        <ContactForm type="FEEDBACK" messageLabel="Your feedback" messagePlaceholder="What would make openmaths better for you?" />
      </Reveal>
    </Section>
  );
}
