import { requireUser } from "@/lib/currentUser";
import { AppearanceSettings, type PersonalizationData } from "@/components/settings/AppearanceSettings";

export default async function AppearanceSettingsPage() {
  const user = await requireUser();
  const raw = (user.personalization as Partial<PersonalizationData> | null) ?? {};
  const initialPersonalization: PersonalizationData = {
    role: raw.role ?? "",
    subjects: raw.subjects ?? "",
    about: raw.about ?? "",
  };

  return <AppearanceSettings initialPersonalization={initialPersonalization} />;
}
