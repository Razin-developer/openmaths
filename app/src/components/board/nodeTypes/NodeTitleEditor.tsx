"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useBoardContext } from "@/components/board/boardContext";
import { api } from "@openmaths/api-client";

export function NodeTitleEditor({
  blockId,
  title,
  className,
}: {
  blockId: string;
  title: string;
  className?: string;
}) {
  const ctx = useBoardContext();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = value.trim();
    setEditing(false);
    if (!trimmed || trimmed === title) {
      setValue(title);
      return;
    }

    const previousTitle = title;
    // Update immediately so the header reflects the new title without waiting on the network —
    // the spinner below is just a "still confirming with the server" affordance, not a gate.
    ctx.updateBlock(blockId, { title: trimmed });
    setSaving(true);
    try {
      await api.blocks.update(blockId, { title: trimmed });
    } catch {
      ctx.updateBlock(blockId, { title: previousTitle });
      setValue(previousTitle);
      toast.error("Couldn't save the title — try again");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(title);
            setEditing(false);
          }
        }}
        className={className ?? "nodrag h-5 min-w-0 flex-1 text-[11.5px]"}
      />
    );
  }

  return (
    <button
      onClick={() => {
        setValue(title);
        setEditing(true);
      }}
      className="nodrag flex min-w-0 max-w-full items-center gap-1 rounded px-0.5 text-left hover:bg-accent"
    >
      <span className="min-w-0 truncate text-[11.5px] font-medium">{title}</span>
      {saving && <Loader2 className="size-2.5 shrink-0 animate-spin text-muted-foreground" />}
    </button>
  );
}
