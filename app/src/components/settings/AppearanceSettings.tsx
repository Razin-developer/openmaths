"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import {
  usePreferences,
  FONT_SIZE_LABEL,
  FONT_FAMILY_LABEL,
  type FontSize,
  type FontFamily,
} from "@/components/preferences-provider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@openmaths/api-client";

const FONT_SIZES: FontSize[] = ["sm", "md", "lg"];
const FONT_FAMILIES: FontFamily[] = ["sans", "serif", "mono", "rounded", "classic"];

export interface PersonalizationData {
  role: string;
  subjects: string;
  about: string;
}

export function AppearanceSettings({ initialPersonalization }: { initialPersonalization: PersonalizationData }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { fontSize, fontFamily, setFontSize, setFontFamily } = usePreferences();
  const [personalization, setPersonalization] = useState(initialPersonalization);
  const [saving, setSaving] = useState(false);

  function updateFontSize(next: string) {
    setFontSize(next as FontSize);
    api.user.update({ fontSize: next }).catch(() => {});
  }

  function updateFontFamily(next: string) {
    setFontFamily(next as FontFamily);
    api.user.update({ fontFamily: next }).catch(() => {});
  }

  async function handleSavePersonalization() {
    setSaving(true);
    try {
      await api.user.update({ personalization });
      toast.success("Personalization saved");
    } catch {
      toast.error("Couldn't save personalization");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
        <div>
          <Label htmlFor="dark-mode" className="text-xs">
            Dark mode
          </Label>
          <p className="text-[11px] text-muted-foreground">Strict monochrome — no other theme options.</p>
        </div>
        <Switch
          id="dark-mode"
          checked={resolvedTheme === "dark"}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Font size</Label>
        <Select value={fontSize} onValueChange={updateFontSize}>
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((size) => (
              <SelectItem key={size} value={size} className="text-xs">
                {FONT_SIZE_LABEL[size]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Font family</Label>
        <Select value={fontFamily} onValueChange={updateFontFamily}>
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((family) => (
              <SelectItem key={family} value={family} className="text-xs">
                {FONT_FAMILY_LABEL[family]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <p className="text-xs font-medium">Personalization</p>
          <p className="text-[11px] text-muted-foreground">
            Help the AI tailor answers to you — this gets included as context on every question.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role" className="text-xs">
            What&apos;s your role or level?
          </Label>
          <Input
            id="role"
            value={personalization.role}
            onChange={(e) => setPersonalization((p) => ({ ...p, role: e.target.value }))}
            placeholder="e.g. High school student, grade 10"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="subjects" className="text-xs">
            What subjects or topics are you focused on?
          </Label>
          <Input
            id="subjects"
            value={personalization.subjects}
            onChange={(e) => setPersonalization((p) => ({ ...p, subjects: e.target.value }))}
            placeholder="e.g. Algebra, trigonometry"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="about" className="text-xs">
            Anything else the AI should know about you?
          </Label>
          <Textarea
            id="about"
            value={personalization.about}
            onChange={(e) => setPersonalization((p) => ({ ...p, about: e.target.value }))}
            placeholder="e.g. I learn best with visual diagrams and step-by-step breakdowns."
            className="min-h-16 text-xs"
          />
        </div>
        <Button size="sm" onClick={handleSavePersonalization} disabled={saving} className="text-xs">
          {saving ? "Saving…" : "Save personalization"}
        </Button>
      </div>
    </div>
  );
}
