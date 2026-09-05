import { requireUser } from "@/lib/currentUser";
import { serverApiOptions } from "@/lib/serverApi";
import { UsageStatsView } from "@/components/settings/UsageStats";
import { api } from "@openmaths/api-client";
import type { UsageStats } from "@/lib/ai/usageStats";

// PRD "Split into app + server" P3-continued — converted from direct Prisma access to
// serverApi(); this page no longer imports @/lib/prisma.
export default async function UsageSettingsPage() {
  await requireUser();
  const opts = await serverApiOptions();
  const { stats } = await api.usage.stats(opts);

  return <UsageStatsView stats={stats as UsageStats} />;
}
