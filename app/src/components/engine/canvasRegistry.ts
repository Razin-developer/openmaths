/**
 * Non-reactive registry of mounted BlockCanvas DOM elements, keyed by blockId.
 * Lets PDF export grab a canvas snapshot without threading refs through the
 * node/board component tree (the exporter and the canvas live in different subtrees
 * once a node is shown fullscreen via a portal).
 */
const registry = new Map<string, HTMLCanvasElement>();

export function registerCanvasEl(blockId: string, el: HTMLCanvasElement | null) {
  if (el) registry.set(blockId, el);
  else registry.delete(blockId);
}

export function getCanvasEl(blockId: string): HTMLCanvasElement | undefined {
  return registry.get(blockId);
}

/**
 * PRD B3 — static-mode node-card previews (`${blockId}:preview` keys) no longer hold a live
 * WebGL canvas once captured (see BlockCanvas.tsx's raster-snapshot preview) — nothing to
 * `toDataURL()` on demand anymore. This is the equivalent lookup for that case: the data URL
 * captured the one time the preview was actually rendered, kept only as long as its React
 * component stays mounted (so it never grows into an unbounded server-lifetime cache).
 */
const snapshotRegistry = new Map<string, string>();

export function registerSnapshotDataUrl(blockId: string, dataUrl: string | null) {
  if (dataUrl) snapshotRegistry.set(blockId, dataUrl);
  else snapshotRegistry.delete(blockId);
}

export function getSnapshotDataUrl(blockId: string): string | undefined {
  return snapshotRegistry.get(blockId);
}
