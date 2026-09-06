import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Report a Bug",
  description: "Found something broken? Let us know what happened.",
  alternates: { canonical: "https://openmaths.com/report-bug" },
};

export default function ReportBugPage() {
  return (
    <Section className="text-center">
      <Reveal>
        <h1 className="text-display-xl font-semibold text-balance">Report a bug</h1>
      </Reveal>
      <Reveal index={1}>
        <p className="mx-auto mt-4 max-w-[50ch] text-body-lg text-muted-foreground">
          Include what you expected to happen and what actually happened — the more specific, the faster we can track it down.
        </p>
      </Reveal>
      <Reveal index={2} className="mt-10">
        <ContactForm type="BUG_REPORT" messageLabel="What happened?" messagePlaceholder="Steps to reproduce, what you expected, what you saw instead…" />
      </Reveal>
    </Section>
  );
}
