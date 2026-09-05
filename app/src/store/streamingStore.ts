import { create } from "zustand";

export type StatusPhase = "thinking" | "diagram" | null;

interface StreamingState {
  text: string;
  phase: StatusPhase;
}

const DEFAULT_STATE: StreamingState = { text: "", phase: null };

interface StreamingStore {
  streams: Record<string, StreamingState>;
  get: (blockId: string) => StreamingState;
  start: (blockId: string) => void;
  appendDelta: (blockId: string, text: string) => void;
  reset: (blockId: string) => void;
  setPhase: (blockId: string, phase: StatusPhase) => void;
  clear: (blockId: string) => void;
}

// PRD "Performance Audit & Answer-Rendering Fix" B4 — `appendDelta` used to `set()` on every
// single network chunk: a full `streams` object spread, a string concat, and a synchronous
// zustand notify → React re-render → ReactMarkdown re-parsing the whole growing answer, once per
// chunk (roughly O(n²) over the stream). These two maps buffer text per block between animation
// frames so however many chunks arrive within one frame collapse into a single `set()` — the
// visible typing speed is unchanged (still flushes ~60x/sec, well above perceptible), but the
// render/parse count drops from "once per network chunk" to "at most once per frame".
const pendingText: Record<string, string> = {};
const rafHandles: Record<string, number> = {};

function cancelPendingFlush(blockId: string) {
  const handle = rafHandles[blockId];
  if (handle !== undefined) {
    cancelAnimationFrame(handle);
    delete rafHandles[blockId];
  }
  delete pendingText[blockId];
}

/** Applies any not-yet-flushed buffered text immediately instead of waiting for the next
 * animation frame — used by `clear()` so the stream's final chunk(s) can't get silently dropped
 * by a `finally`-block clear racing the pending rAF (unlike `reset()`, which discards on purpose
 * — that path means the old output is being thrown away for a fresh restart). */
function flushPending(blockId: string, set: (fn: (s: StreamingStore) => Partial<StreamingStore>) => void) {
  const toFlush = pendingText[blockId];
  cancelPendingFlush(blockId);
  if (!toFlush) return;
  set((s) => {
    const current = s.streams[blockId] ?? DEFAULT_STATE;
    return { streams: { ...s.streams, [blockId]: { ...current, text: current.text + toFlush } } };
  });
}

export const useStreamingStore = create<StreamingStore>((set, get) => ({
  streams: {},

  get: (blockId) => get().streams[blockId] ?? DEFAULT_STATE,

  start: (blockId) => {
    cancelPendingFlush(blockId);
    set((s) => ({ streams: { ...s.streams, [blockId]: { text: "", phase: "thinking" } } }));
  },

  appendDelta: (blockId, text) => {
    pendingText[blockId] = (pendingText[blockId] ?? "") + text;
    if (rafHandles[blockId] !== undefined) return; // a flush is already scheduled for this block
    rafHandles[blockId] = requestAnimationFrame(() => {
      delete rafHandles[blockId];
      const toFlush = pendingText[blockId] ?? "";
      delete pendingText[blockId];
      if (!toFlush) return;
      set((s) => {
        const current = s.streams[blockId] ?? DEFAULT_STATE;
        return { streams: { ...s.streams, [blockId]: { ...current, text: current.text + toFlush } } };
      });
    });
  },

  reset: (blockId) => {
    cancelPendingFlush(blockId);
    set((s) => {
      const current = s.streams[blockId] ?? DEFAULT_STATE;
      return { streams: { ...s.streams, [blockId]: { ...current, text: "" } } };
    });
  },

  setPhase: (blockId, phase) =>
    set((s) => {
      const current = s.streams[blockId] ?? DEFAULT_STATE;
      return { streams: { ...s.streams, [blockId]: { ...current, phase } } };
    }),

  clear: (blockId) => {
    flushPending(blockId, set);
    set((s) => {
      const rest = { ...s.streams };
      delete rest[blockId];
      return { streams: rest };
    });
  },
}));
