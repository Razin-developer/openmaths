import { requireUser } from "@/lib/currentUser";
import { ModelSettings } from "@/components/settings/ModelSettings";

export default async function ModelSettingsPage() {
  const user = await requireUser();
  return (
    <ModelSettings
      initialModelId={user.defaultModelId}
      initialImageModelId={user.imageModelId}
      initialFileModelId={user.fileModelId}
      initialDrawingModelId={user.drawingModelId}
    />
  );
}
