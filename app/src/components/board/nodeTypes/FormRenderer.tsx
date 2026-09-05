"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Shapes } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Form } from "@/lib/ai/envelope";
import type { BlockData } from "@/lib/board/types";
import { SolutionSteps } from "@/components/board/nodeTypes/SolutionSteps";
import { TableForm } from "@/components/board/nodeTypes/TableForm";
import { useBoardUiStore } from "@/store/boardUiStore";

function normalizeTitle(title: string | null | undefined): string {
  return (title ?? "").replace(/^Diagram:\s*/i, "").trim().toLowerCase();
}

/**
 * Pairs each geometry/plot form with its connected GRAPH block, in order — mirrors syncGraphNode's
 * own matching (title first), falling back to positional zip against whatever diagram blocks are
 * left unmatched so an untitled form (or a form whose title doesn't exactly land, e.g. the model
 * paraphrased it) still finds a diagram rather than showing "still drawing" forever once one
 * genuinely exists.
 */
function matchDiagramBlocks(forms: Form[], diagramBlocks: BlockData[]): (BlockData | undefined)[] {
  const remaining = [...diagramBlocks];
  return forms.map((form) => {
    if (form.kind !== "geometry" && form.kind !== "plot") return undefined;
    const titleIdx = form.title
      ? remaining.findIndex((b) => normalizeTitle(b.title) === normalizeTitle(form.title))
      : -1;
    if (titleIdx >= 0) return remaining.splice(titleIdx, 1)[0];
    return remaining.shift();
  });
}

function FormDiagramCard({ diagramBlock }: { diagramBlock: BlockData | undefined }) {
  const setFullscreen = useBoardUiStore((s) => s.setFullscreen);
  const ready = !!diagramBlock?.scene;
  const clickable = ready && !!diagramBlock;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => diagramBlock && setFullscreen(diagramBlock.id, true)}
      className={cn(
        "nodrag my-1 flex w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-left text-[11px] text-muted-foreground",
        clickable && "hover:bg-accent hover:text-foreground"
      )}
    >
      <Shapes className={cn("size-3 shrink-0", !clickable && "animate-pulse")} />
      {clickable ? "Diagram drawn — see the diagram node above" : "Drawing diagram…"}
    </button>
  );
}

/**
 * PRD v2 §5 — renders a message's `forms[]` in the order the model chose, reusing the exact same
 * SolutionSteps/TableForm/diagram-card pieces the default flat-field rendering uses (never
 * duplicating their logic). Only reached when `message.forms` is present — the overwhelming
 * majority of messages have no `forms` and keep rendering through MessageBubble's original
 * solution/table/scene path untouched.
 *
 * Note: unlike the flat path, prose here renders without hover-label-linking to the diagram (no
 * single scene to build a label map against when a message may carry several) — a reasonable
 * simplification for what PRD v2 §5.4 calls a rare path, not a regression of the primary one.
 */
export function FormRenderer({
  forms,
  diagramBlocks,
  blockId,
}: {
  forms: Form[];
  /** Every GRAPH block connected to the owning question — matched to geometry/plot forms by
   * title (see matchDiagramBlocks). */
  diagramBlocks: BlockData[];
  blockId?: string;
}) {
  const matchedDiagrams = useMemo(() => matchDiagramBlocks(forms, diagramBlocks), [forms, diagramBlocks]);

  return (
    <div className="space-y-1.5">
      {forms.map((form, i) => {
        switch (form.kind) {
          case "prose":
            return (
              <ReactMarkdown key={i} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {form.markdown}
              </ReactMarkdown>
            );
          case "solution_steps":
            return <SolutionSteps key={i} steps={form.steps} blockId={blockId} explainBlockId={blockId} />;
          case "table":
            return <TableForm key={i} table={form} />;
          case "geometry":
          case "plot":
            return <FormDiagramCard key={i} diagramBlock={matchedDiagrams[i]} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
