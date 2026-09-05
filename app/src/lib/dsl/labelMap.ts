import type { Scene } from "@/lib/dsl/types";

/** Maps each op's `meta.label` (e.g. "AB", "∠B") to that op's id, for hover-linking text mentions to diagram elements. */
export function buildLabelMap(scene: Scene | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!scene) return map;

  for (const op of scene.ops) {
    const label = op.meta?.label;
    if (label && !map.has(label)) {
      map.set(label, op.id);
    }
  }

  return map;
}
