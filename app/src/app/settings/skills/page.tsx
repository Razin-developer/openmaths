import { requireUser } from "@/lib/currentUser";
import { serverApiOptions } from "@/lib/serverApi";
import { SkillsSettings } from "@/components/settings/SkillsSettings";
import { api } from "@openmaths/api-client";

// PRD "Split into app + server" P3-continued — converted from direct Prisma access to
// serverApi(); this app no longer imports @/lib/prisma here.
export default async function SkillsSettingsPage() {
  await requireUser();
  const opts = await serverApiOptions();
  const { skills } = await api.skills.list(opts);

  return <SkillsSettings initialSkills={skills} />;
}
