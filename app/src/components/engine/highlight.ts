import type { DrawOp } from "@/lib/dsl/types";

/**
 * The set of op ids that should render as "highlighted" when `hoveredOpId` is
 * hovered — the op itself, whatever it targets, and whatever targets it (so
 * hovering a side highlights its label and vice versa).
 */
export function computeHighlightGroup(ops: DrawOp[], hoveredOpId: string | null): Set<string> {
  if (!hoveredOpId) return new Set();
  const group = new Set<string>([hoveredOpId]);

  for (const op of ops) {
    const targetId = "targetId" in op ? op.targetId : undefined;
    if (op.id === hoveredOpId && targetId) group.add(targetId);
    if (targetId === hoveredOpId) group.add(op.id);
  }

  return group;
}
