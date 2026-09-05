import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { useBlockStore } from "@/store/blockStore";

/**
 * Shared react-markdown config for AI answers: safe external links, no raw HTML,
 * tight spacing to match the compact monochrome chat-bubble UI.
 */
const baseMarkdownComponents: Components = {
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" {...props}>
      {children}
    </a>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
};

/** Falls back to base components when there's no diagram to hover-link against (e.g. USER messages). */
export const markdownComponents = baseMarkdownComponents;

function LabelMentionSpan({
  opId,
  diagramBlockId,
  children,
}: {
  opId?: string;
  diagramBlockId: string;
  children?: React.ReactNode;
}) {
  const hovered = useBlockStore((s) => (s.blocks[diagramBlockId] ?? s.get(diagramBlockId)).hoveredOpId === opId);
  const setHovered = useBlockStore((s) => s.setHovered);

  if (!opId) return <>{children}</>;

  return (
    <span
      className={cn(
        "cursor-default rounded px-0.5 underline decoration-dotted decoration-muted-foreground underline-offset-2",
        hovered && "bg-accent font-medium text-accent-foreground"
      )}
      onMouseEnter={() => setHovered(diagramBlockId, opId)}
      onMouseLeave={() => setHovered(diagramBlockId, null)}
    >
      {children}
    </span>
  );
}

/** Markdown components with hover-linking wired to `diagramBlockId`'s scene (see remarkLabelMentions). */
export function getMarkdownComponents(diagramBlockId: string | null): Components {
  if (!diagramBlockId) return baseMarkdownComponents;
  return {
    ...baseMarkdownComponents,
    "label-mention": (props: { opId?: string; children?: React.ReactNode }) => (
      <LabelMentionSpan {...props} diagramBlockId={diagramBlockId} />
    ),
  } as Components;
}
