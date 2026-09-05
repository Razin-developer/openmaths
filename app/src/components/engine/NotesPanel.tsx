"use client";

import { useMemo } from "react";
import type { Scene } from "@/lib/dsl/types";
import { buildLabelMap } from "@/lib/dsl/labelMap";
import { useBlockStore } from "@/store/blockStore";
import { HighlightableText } from "@/components/engine/HighlightableText";

export function NotesPanel({ blockId, scene }: { blockId: string; scene: Scene }) {
  const currentOpIndex = useBlockStore((s) => (s.blocks[blockId] ?? s.get(blockId)).currentOpIndex);
  const status = useBlockStore((s) => (s.blocks[blockId] ?? s.get(blockId)).status);
  const labelMap = useMemo(() => buildLabelMap(scene), [scene]);

  const revealedUpTo = status === "done" ? scene.ops.length - 1 : currentOpIndex;
  const notes = scene.ops.filter((op, index) => op.op === "write_note" && index <= revealedUpTo);

  if (notes.length === 0) {
    return <p className="text-xs text-muted-foreground">Notes will appear here as the steps play.</p>;
  }

  return (
    <ol className="space-y-2">
      {notes.map((op, index) => (
        <li key={op.id} className="text-xs leading-relaxed text-foreground">
          <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>
          {op.op === "write_note" ? (
            <HighlightableText text={op.text} labelMap={labelMap} blockId={blockId} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
