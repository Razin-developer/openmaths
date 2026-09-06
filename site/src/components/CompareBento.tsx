import { Button } from "./Button";

interface CompareBentoProps {
  leftEyebrow: string;
  leftTitle: string;
  leftBody: string;
  leftAnswer: string;
  rightEyebrow: string;
  rightTitle: string;
  rightBody: string;
  rightCta: string;
  rightHref: string;
}

/**
 * The reference's asymmetric two-card contrast ("fighting infra" vs "shipping with us") — ours
 * contrasts a bare calculator answer against openmaths actually explaining it, which is the
 * product's own stated thesis, not the reference's infrastructure story.
 */
export function CompareBento({
  leftEyebrow,
  leftTitle,
  leftBody,
  leftAnswer,
  rightEyebrow,
  rightTitle,
  rightBody,
  rightCta,
  rightHref,
}: CompareBentoProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="flex flex-col justify-between gap-8 rounded-xl border border-border-hairline bg-surface-card p-8">
        <span className="text-caption font-mono-code uppercase tracking-wide text-muted-foreground">{leftEyebrow}</span>
        <div>
          <h3 className="text-h3 font-semibold text-balance">{leftTitle}</h3>
          <p className="mt-3 text-body text-muted-foreground">{leftBody}</p>
        </div>
        <div className="rounded-lg border border-border-hairline bg-surface-shell p-6 text-center">
          <span className="font-mono-code text-display-xl font-semibold text-muted-foreground">{leftAnswer}</span>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-8 rounded-xl p-8 text-white" style={{ background: "var(--gradient-reasoning)" }}>
        <span className="text-caption font-mono-code uppercase tracking-wide text-white">{rightEyebrow}</span>
        <div>
          <h3 className="text-h3 font-semibold text-balance">{rightTitle}</h3>
          <p className="mt-3 text-body text-white/90">{rightBody}</p>
        </div>
        <Button href={rightHref} variant="secondary" className="self-start !bg-white !text-accent-blue-600 hover:opacity-90" ctaId="compare-see-it-work">
          {rightCta}
        </Button>
      </div>
    </div>
  );
}
