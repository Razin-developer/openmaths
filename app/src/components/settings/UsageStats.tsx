import type { UsageStats } from "@/lib/ai/usageStats";

function formatCost(usd: number | null): string {
  if (usd === null) return "—";
  if (usd === 0) return "$0.00";
  // Generations on these models are often fractions of a cent — 2 decimals would just show
  // "$0.00" for almost everything, which isn't useful for a page whose whole point is showing
  // spend. Scale precision to the size of the number instead.
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTokens(n: number): string {
  return n.toLocaleString("en-US");
}

export function UsageStatsView({ stats }: { stats: UsageStats }) {
  if (stats.totalRequests === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No AI generations recorded yet — ask a question and this page will start tracking cost and token usage.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label={stats.anyUnknownCost ? "Spent (known)" : "Total spent"} value={formatCost(stats.totalCostUsd)} />
        <SummaryCard label="Requests" value={formatTokens(stats.totalRequests)} />
        <SummaryCard label="Tokens" value={formatTokens(stats.totalTokens)} />
      </div>

      {(stats.anyEstimated || stats.anyUnknownCost) && (
        <p className="text-[10.5px] text-muted-foreground">
          {stats.anyEstimated &&
            "Some token/cost figures are estimates (~4 characters/token) rather than exact API-reported usage — the model provider doesn't return token counts for streamed responses, marked with “≈” below. "}
          {stats.anyUnknownCost &&
            "Voice narration cost isn't reported by the provider, so the total above is a floor — it excludes any voice generations, marked “—” below."}
        </p>
      )}

      <div className="space-y-1.5">
        <h3 className="text-xs font-medium">By model</h3>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-2.5 py-1.5 font-medium">Model</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Requests</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Tokens</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {stats.byModel.map((m) => (
                <tr key={`${m.kind}:${m.modelId}`} className="border-b border-border last:border-0">
                  <td className="px-2.5 py-1.5 font-mono text-[11px]">
                    {m.modelId}
                    {m.kind === "tts" && <span className="ml-1 text-muted-foreground">(voice)</span>}
                    {m.kind === "stt" && <span className="ml-1 text-muted-foreground">(speech-to-text)</span>}
                  </td>
                  <td className="px-2.5 py-1.5 text-right">{formatTokens(m.requests)}</td>
                  <td className="px-2.5 py-1.5 text-right">{formatTokens(m.totalTokens)}</td>
                  <td className="px-2.5 py-1.5 text-right">
                    {m.estimated && "≈ "}
                    {formatCost(m.costUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-xs font-medium">Recent generations</h3>
        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="sticky top-0 border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-2.5 py-1.5 font-medium">When</th>
                <th className="px-2.5 py-1.5 font-medium">Model</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Tokens</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-2.5 py-1.5 text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-[11px]">{r.modelId}</td>
                  <td className="px-2.5 py-1.5 text-right">{formatTokens(r.totalTokens)}</td>
                  <td className="px-2.5 py-1.5 text-right">
                    {r.estimated && "≈ "}
                    {formatCost(r.costUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <p className="text-[10.5px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
