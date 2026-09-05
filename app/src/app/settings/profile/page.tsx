import { requireUser } from "@/lib/currentUser";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  return (
    <ProfileSettings
      initialDisplayName={user.displayName}
      email={user.email}
      userId={user.id}
      hasPassword={user.hasPassword}
      mfaEnabled={user.mfaEnabled}
    />
  );
}
