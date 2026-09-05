"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { ModelPicker } from "@/components/board/nodeTypes/ModelPicker";
import { api } from "@openmaths/api-client";

interface ModelSettingsProps {
  initialModelId: string | null;
  initialImageModelId: string | null;
  initialFileModelId: string | null;
  initialDrawingModelId: string | null;
}

const FIELDS = [
  {
    key: "defaultModelId" as const,
    label: "Text / default",
    help: "Used for new questions unless changed per-node.",
  },
  {
    key: "imageModelId" as const,
    label: "Image attachments",
    help: "Used automatically when a message includes an image attachment.",
  },
  {
    key: "fileModelId" as const,
    label: "File (PDF) attachments",
    help: "Used automatically when a message includes a PDF attachment.",
  },
  {
    key: "drawingModelId" as const,
    label: "Diagrams / drawing",
    help: "Used when generating a diagram scene for a Graph node.",
  },
];

export function ModelSettings({
  initialModelId,
  initialImageModelId,
  initialFileModelId,
  initialDrawingModelId,
}: ModelSettingsProps) {
  const [values, setValues] = useState({
    defaultModelId: initialModelId,
    imageModelId: initialImageModelId,
    fileModelId: initialFileModelId,
    drawingModelId: initialDrawingModelId,
  });

  async function handleChange(key: keyof typeof values, next: string) {
    setValues((prev) => ({ ...prev, [key]: next }));
    await api.user.update({ [key]: next }).catch(() => {});
  }

  return (
    <div className="space-y-4">
      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          <p className="mb-1 text-[11px] text-muted-foreground">{field.help}</p>
          <ModelPicker value={values[field.key]} onChange={(next) => handleChange(field.key, next)} />
        </div>
      ))}
    </div>
  );
}
