/** Every legal page (PRD §5.1) carries this — these are unreviewed drafts, not real
 * attorney-reviewed policy. Presenting them as final without this notice would be actively
 * misleading to a real visitor relying on them, and a real liability risk besides. */
export function LegalNotice() {
  return (
    <div className="mx-auto mb-8 max-w-[68ch] rounded-lg border border-warning/40 bg-warning/10 px-5 py-4 text-body-sm text-foreground">
      <strong>Draft — not reviewed by legal counsel.</strong> This page is a template placeholder,
      not a finalized policy. Do not rely on it as your actual privacy/terms/security commitment
      until a qualified lawyer has reviewed and approved it for your jurisdiction.
    </div>
  );
}
