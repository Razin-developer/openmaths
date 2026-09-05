const KIND_FILL: Record<string, string> = {
  QUESTION: "var(--foreground)",
  SUB_QUESTION: "var(--foreground)",
  GRAPH: "var(--muted-foreground)",
  NOTE: "var(--border)",
  LINK: "var(--border)",
};

interface BlockSummary {
  id: string;
  kind: string;
  positionX: number;
  positionY: number;
}

const PADDING = 10;
const VIEW_W = 100;
const VIEW_H = 64;

/**
 * A synthetic "map" thumbnail (not a real screenshot) — each block's stored position renders
 * as a small colored rect scaled into a fixed viewBox, giving a recognizable layout shape
 * without needing to capture, store, or regenerate an actual canvas image.
 */
export function CanvasThumbnail({ blocks }: { blocks: BlockSummary[] }) {
  if (blocks.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
        Empty
      </div>
    );
  }

  const xs = blocks.map((b) => b.positionX);
  const ys = blocks.map((b) => b.positionY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs, minX + 1);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys, minY + 1);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {blocks.map((b) => {
        const x = PADDING + ((b.positionX - minX) / spanX) * (VIEW_W - PADDING * 2);
        const y = PADDING + ((b.positionY - minY) / spanY) * (VIEW_H - PADDING * 2);
        return (
          <rect
            key={b.id}
            x={x - 6}
            y={y - 4}
            width={12}
            height={8}
            rx={1.5}
            fill={KIND_FILL[b.kind] ?? "var(--border)"}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}
