"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getSnapshotDataUrl } from "@/components/engine/canvasRegistry";
import type { BlockData } from "@/lib/board/types";
import type { BoardContext } from "@/components/board/Board";
import { api } from "@openmaths/api-client";

export function ExportButton({ block, ctx }: { block: BlockData; ctx: BoardContext }) {
  const graphBlock = ctx.getConnectedGraphBlock(block.id);
  const [exporting, setExporting] = useState(false);
  const disabled = block.status !== "READY" || exporting;

  async function handleExport() {
    setExporting(true);
    try {
      const diagramImageDataUrl = graphBlock ? getSnapshotDataUrl(`${graphBlock.id}:preview`) : undefined;

      const res = await api.blocks.exportPdf(block.id, diagramImageDataUrl).catch(() => null);
      if (!res) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(block.title || block.prompt || "question").slice(0, 60)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" onClick={handleExport} disabled={disabled} aria-label="Export PDF">
          {exporting ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {graphBlock ? "Export PDF" : "Export PDF (no diagram for this question)"}
      </TooltipContent>
    </Tooltip>
  );
}
