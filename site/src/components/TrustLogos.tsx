import { TRUST_SUBJECTS } from "@/lib/trust-data";

/**
 * Landing-rework PRD §4.4: the reference's "as used by" institutional logo row, adapted honestly —
 * openmaths has no real institutional or press relationships to claim (see `trust-data.ts`'s own
 * comment), so this shows the actual subjects the product covers instead of implying endorsements
 * that don't exist. True today, not aspirational.
 */
export function TrustLogos() {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-caption font-mono-code uppercase tracking-wide text-muted-foreground">Every major topic, covered</span>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {TRUST_SUBJECTS.map((subject) => (
          <span key={subject} className="text-body font-semibold text-muted-foreground/70 grayscale">
            {subject}
          </span>
        ))}
      </div>
    </div>
  );
}
