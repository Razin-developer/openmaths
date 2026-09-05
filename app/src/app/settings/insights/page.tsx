import { requireUser } from "@/lib/currentUser";
import { serverApiOptions } from "@/lib/serverApi";
import { FunnelStatsView } from "@/components/settings/FunnelStatsView";
import { api } from "@openmaths/api-client";
import type { FunnelStats } from "@/lib/ai/funnelStats";

// PRD "Split into app + server" P3-continued — converted from direct Prisma access to
// serverApi(); this page no longer imports @/lib/prisma.
export default async function InsightsSettingsPage() {
  await requireUser();
  const opts = await serverApiOptions();
  const { stats } = await api.insights.get(opts);

  return <FunnelStatsView stats={stats as FunnelStats} />;
}
