import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "Community",
  description: "Where to reach the openmaths team directly, until a larger community space exists.",
};

/**
 * Deliberately doesn't claim a Discord/forum that doesn't exist yet, or fabricate a member count
 * — the PRD's §5.3 stack ("showcase gallery, Discord/forum, ambassadors") is real future scope,
 * not something to fake with a broken invite link or an invented number.
 */
export default function CommunityPage() {
  return (
    <Section className="text-center">
      <Reveal>
        <h1 className="text-display-xl font-semibold text-balance">Community</h1>
      </Reveal>
      <Reveal index={1}>
        <p className="mx-auto mt-4 max-w-[50ch] text-body-lg text-muted-foreground">
          There&rsquo;s no dedicated Discord or forum yet — for now, <a href="/feedback" className="text-accent underline underline-offset-4">feedback</a> and{" "}
          <a href="/contact" className="text-accent underline underline-offset-4">direct contact</a> are the fastest ways to reach the team building this.
        </p>
      </Reveal>
      <Reveal index={2} className="mt-8">
        <Button href="/feedback" variant="primary">
          Share feedback
        </Button>
      </Reveal>
    </Section>
  );
}
