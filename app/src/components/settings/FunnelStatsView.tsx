import type { FunnelStats } from "@/lib/ai/funnelStats";

function formatPercent(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <p className="text-[10.5px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

const FORM_KIND_LABEL: Record<string, string> = {
  prose: "Prose",
  solution_steps: "Structured steps",
  table: "Table",
  geometry: "Diagram",
  forms: "Multi-form",
  unknown: "Unknown",
};

export function FunnelStatsView({ stats }: { stats: FunnelStats }) {
  if (stats.totalGenerations === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No generations recorded yet — ask a question and this page will start tracking how
        students actually use and complete your explanations.
      </p>
    );
  }

  const maxFormKindCount = Math.max(...stats.byFormKind.map((f) => f.count), 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="Generations" value={stats.totalGenerations.toLocaleString("en-US")} />
        <SummaryCard label="Self-check corrections" value={formatPercent(stats.verificationCorrectedRate)} />
        <SummaryCard label="Walkthroughs completed" value={stats.stepCompletions.toLocaleString("en-US")} />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-xs font-medium">Answer form chosen</h3>
        <p className="text-[10.5px] text-muted-foreground">
          Which representation the model actually reached for, across every generation — a plain
          explanation, structured steps, a table, a diagram, or (rarely) more than one form
          combined.
        </p>
        <div className="space-y-1.5">
          {stats.byFormKind.map((f) => (
            <div key={f.formKind} className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-[11px] text-muted-foreground">{FORM_KIND_LABEL[f.formKind] ?? f.formKind}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${Math.max((f.count / maxFormKindCount) * 100, 3)}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{f.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-xs font-medium">Completion &amp; replay (Zeigarnik signal)</h3>
        <p className="text-[10.5px] text-muted-foreground">
          A walkthrough watched all the way to its last step — not scrubbed to it, not abandoned
          partway.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <SummaryCard label="Completed (any)" value={stats.stepCompletions.toLocaleString("en-US")} />
          <SummaryCard label="Completed with narration on" value={stats.narratedStepCompletions.toLocaleString("en-US")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-xs font-medium">Video exports</h3>
        <p className="text-[10.5px] text-muted-foreground">Silent vs. voiced-over — how often the narration feature actually gets used at export time.</p>
        <div className="grid grid-cols-2 gap-2">
          <SummaryCard label="Total exports" value={stats.videoExports.toLocaleString("en-US")} />
          <SummaryCard
            label="With voiceover"
            value={stats.videoExports > 0 ? `${stats.voicedVideoExports} (${formatPercent(stats.voicedVideoExports / stats.videoExports)})` : "0"}
          />
        </div>
      </div>
    </div>
  );
}
