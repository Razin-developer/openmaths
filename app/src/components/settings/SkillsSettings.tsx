"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api, type SkillData } from "@openmaths/api-client";

const EMPTY_FORM = { name: "", description: "", instructions: "" };

export function SkillsSettings({ initialSkills }: { initialSkills: SkillData[] }) {
  const [skills, setSkills] = useState(initialSkills);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiDescription, setAiDescription] = useState("");

  const builtIns = skills.filter((s) => s.isBuiltIn);
  const custom = skills.filter((s) => !s.isBuiltIn);

  function openCreate() {
    setForm(EMPTY_FORM);
    setAiDescription("");
    setOpen(true);
  }

  // PRD "Split into app + server" P3-continued — cut over to the base-URL client; /skills is now
  // ported to `server`.
  async function handleGenerateWithAi() {
    if (!aiDescription.trim()) return;
    setGenerating(true);
    try {
      const { draft } = await api.skills.generate(aiDescription.trim());
      setForm({ name: draft.name, description: draft.description, instructions: draft.instructions });
      toast.success("Draft generated — review and save below");
    } catch {
      toast.error("Couldn't generate a skill from that description");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.instructions.trim()) {
      toast.error("Name and instructions are required");
      return;
    }
    setSaving(true);
    try {
      const { skill } = await api.skills.create(form);
      setSkills((prev) => [...prev, skill]);
      setOpen(false);
      toast.success("Skill created");
    } catch {
      toast.error("Couldn't save that skill");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSkills((prev) => prev.filter((s) => s.id !== id));
    try {
      await api.skills.remove(id);
    } catch {
      toast.error("Couldn't delete that skill");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div>
          <p className="text-xs font-medium">Built-in skills</p>
          <p className="text-[11px] text-muted-foreground">
            Always available from the / picker in any question&apos;s prompt box.
          </p>
        </div>
        <div className="space-y-1.5">
          {builtIns.map((skill) => (
            <div key={skill.id} className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-xs font-medium">{skill.name}</p>
                <p className="text-[11px] text-muted-foreground">{skill.description}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                Built-in
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium">Your skills</p>
            <p className="text-[11px] text-muted-foreground">Custom response styles you&apos;ve written or generated.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={openCreate}>
            <Plus className="size-3" /> New skill
          </Button>
        </div>
        {custom.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No custom skills yet.</p>
        ) : (
          <div className="space-y-1.5">
            {custom.map((skill) => (
              <div key={skill.id} className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-xs font-medium">{skill.name}</p>
                  <p className="text-[11px] text-muted-foreground">{skill.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete skill"
                  onClick={() => handleDelete(skill.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">New skill</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-md border border-border p-2.5">
              <Label className="text-[11px]">Describe the style you want, and let AI draft it</Label>
              <div className="flex gap-1.5">
                <Input
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="e.g. Answer like a strict exam grader"
                  className="h-8 text-xs"
                />
                <Button size="icon-sm" onClick={handleGenerateWithAi} disabled={generating} aria-label="Generate">
                  <Sparkles className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Instructions</Label>
              <Textarea
                value={form.instructions}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                placeholder="How should the AI style its response when this skill is active?"
                className="min-h-20 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" className="text-xs" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
