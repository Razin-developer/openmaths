import { create } from "zustand";

export type NodeLayoutState = "collapsed" | "default";
export type BoardTool = "pan" | "select";
/** Question-node fullscreen only (PRD "Fullscreen Player & Animation UX" §6.1) — the graph/note/
 * web-browser fullscreen surfaces are always true edge-to-edge already, so this preference only
 * applies where there's a real windowed vs. full choice to remember. A single session-wide
 * preference, not per-block: it's "how does this user like fullscreen to look", not a per-node
 * setting. */
export type FullscreenMode = "windowed" | "full";

interface BlockUiState {
  layout: NodeLayoutState;
  fullscreen: boolean;
  diagramMounted: boolean;
  diagramVisible: boolean;
  lastDiagramShownAt: number;
  /** Once the user drags NodeResizer by hand, that height is their explicit choice — auto-grow
   * (which otherwise expands the node to fit incoming content, up to MAX_NODE_HEIGHT) stops
   * touching this node's height entirely from then on, and overflow past whatever the user set
   * falls to the node's own internal scroll area instead. */
  manuallyResized: boolean;
  /** Sync-highlight (PRD "Explainer Quality, Streaming Stability & Bug Sweep" §6) — the scene
   * step position currently playing/narrating in this GRAPH block's animation player, or null
   * when nothing is playing. Scene step *i* is index-aligned with the connected question's
   * `solution[]` step *i* (server-side, generate.ts's repairSceneCaptions/alignment — §2), so
   * the connected MessageBubble's SolutionSteps reads this to highlight the matching line even
   * after the fullscreen player closes, without the two components knowing about each other. */
  narratedStepPosition: number | null;
}

const DEFAULT_BLOCK_UI: BlockUiState = {
  layout: "default",
  fullscreen: false,
  diagramMounted: false,
  diagramVisible: false,
  lastDiagramShownAt: 0,
  manuallyResized: false,
  narratedStepPosition: null,
};

/** Cap on concurrently-mounted BlockCanvas (WebGL context) instances. */
const MAX_MOUNTED_DIAGRAMS = 6;

interface BoardUiStore {
  blocks: Record<string, BlockUiState>;
  activeTool: BoardTool;
  fullscreenMode: FullscreenMode;
  get: (blockId: string) => BlockUiState;
  toggleCollapsed: (blockId: string, onPause: (blockId: string) => void) => void;
  setFullscreen: (blockId: string, open: boolean) => void;
  toggleFullscreenMode: () => void;
  showDiagram: (blockId: string) => void;
  hideDiagram: (blockId: string, onPause: (blockId: string) => void) => void;
  setActiveTool: (tool: BoardTool) => void;
  setManuallyResized: (blockId: string) => void;
  setNarratedStep: (blockId: string, position: number | null) => void;
}

export const useBoardUiStore = create<BoardUiStore>((set, get) => ({
  blocks: {},
  activeTool: "pan",
  // Defaults to "full" — matches the other three fullscreen surfaces (graph/note/web-browser),
  // which are already always edge-to-edge, so the question-node experience is consistent by
  // default rather than the odd one out (§6.3 "one consistent fullscreen contract").
  fullscreenMode: "full",

  toggleFullscreenMode: () => set((s) => ({ fullscreenMode: s.fullscreenMode === "full" ? "windowed" : "full" })),

  get: (blockId) => get().blocks[blockId] ?? DEFAULT_BLOCK_UI,

  toggleCollapsed: (blockId, onPause) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_BLOCK_UI;
      const collapsing = current.layout === "default";
      if (collapsing) onPause(blockId);
      return {
        blocks: {
          ...s.blocks,
          [blockId]: {
            ...current,
            layout: collapsing ? "collapsed" : "default",
            diagramVisible: collapsing ? false : current.diagramVisible,
          },
        },
      };
    }),

  setFullscreen: (blockId, open) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_BLOCK_UI;
      return { blocks: { ...s.blocks, [blockId]: { ...current, fullscreen: open } } };
    }),

  showDiagram: (blockId) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_BLOCK_UI;
      const blocks = {
        ...s.blocks,
        [blockId]: {
          ...current,
          diagramMounted: true,
          diagramVisible: true,
          lastDiagramShownAt: Date.now(),
        },
      };

      const mounted = Object.entries(blocks).filter(([, v]) => v.diagramMounted);
      if (mounted.length > MAX_MOUNTED_DIAGRAMS) {
        const [oldestId] = mounted.sort((a, b) => a[1].lastDiagramShownAt - b[1].lastDiagramShownAt)[0];
        if (oldestId !== blockId) {
          blocks[oldestId] = { ...blocks[oldestId], diagramMounted: false, diagramVisible: false };
        }
      }

      return { blocks };
    }),

  hideDiagram: (blockId, onPause) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_BLOCK_UI;
      onPause(blockId);
      return { blocks: { ...s.blocks, [blockId]: { ...current, diagramVisible: false } } };
    }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setManuallyResized: (blockId) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_BLOCK_UI;
      if (current.manuallyResized) return s;
      return { blocks: { ...s.blocks, [blockId]: { ...current, manuallyResized: true } } };
    }),

  setNarratedStep: (blockId, position) =>
    set((s) => {
      const current = s.blocks[blockId] ?? DEFAULT_BLOCK_UI;
      if (current.narratedStepPosition === position) return s;
      return { blocks: { ...s.blocks, [blockId]: { ...current, narratedStepPosition: position } } };
    }),
}));
