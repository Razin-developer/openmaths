import { create } from "zustand";
import { api } from "@openmaths/api-client";

export interface NarrationClip {
  step: number;
  audioUrl: string;
  /** The spoken script text for this step — shown in the transcript panel. */
  text: string;
}

interface NarrationEntry {
  /** Sparse, index-by-step — filled progressively as clips stream in. */
  clips: NarrationClip[];
  loading: boolean;
  /** True once every clip for this block's current script has arrived (vs. still streaming in) —
   * distinct from `loading`, which only means "a request is in flight". */
  complete: boolean;
}

const EMPTY_ENTRY: NarrationEntry = { clips: [], loading: false, complete: false };

interface NarrationStore {
  entries: Record<string, NarrationEntry>;
  /** One in-flight promise per blockId — every caller (toggle, export, preload) awaits the SAME
   * promise instead of starting a new `/narrate` stream, which is the actual fix for the
   * duplicate-synthesis bug (PRD "Fullscreen Player & Animation UX" §5.1): the guard has to live
   * here, not in a component, because a component unmounting mid-request must not lose the
   * in-flight marker for the next component that mounts and asks for the same block. */
  inFlight: Record<string, Promise<NarrationClip[]>>;
  get: (blockId: string) => NarrationEntry;
  addClip: (blockId: string, clip: NarrationClip) => void;
  setLoading: (blockId: string, loading: boolean) => void;
  setComplete: (blockId: string, complete: boolean) => void;
  /** Seeds clips directly from `Block.narration` (the DB cache) — used to hydrate instantly on
   * mount without a network round trip when a previous session already synthesized this scene. */
  hydrate: (blockId: string, clips: NarrationClip[]) => void;
}

export const useNarrationStore = create<NarrationStore>((set, get) => ({
  entries: {},
  inFlight: {},

  get: (blockId) => get().entries[blockId] ?? EMPTY_ENTRY,

  addClip: (blockId, clip) =>
    set((s) => {
      const current = s.entries[blockId] ?? EMPTY_ENTRY;
      const clips = [...current.clips];
      clips[clip.step] = clip;
      return { entries: { ...s.entries, [blockId]: { ...current, clips } } };
    }),

  setLoading: (blockId, loading) =>
    set((s) => {
      const current = s.entries[blockId] ?? EMPTY_ENTRY;
      return { entries: { ...s.entries, [blockId]: { ...current, loading } } };
    }),

  setComplete: (blockId, complete) =>
    set((s) => {
      const current = s.entries[blockId] ?? EMPTY_ENTRY;
      return { entries: { ...s.entries, [blockId]: { ...current, complete } } };
    }),

  hydrate: (blockId, clips) =>
    set((s) => {
      // Never clobber clips already in flight/loaded (e.g. a fresher fetch already resolved) —
      // hydration is only useful as the very first paint, not a source of truth once real data
      // has shown up.
      const current = s.entries[blockId];
      if (current && (current.clips.some(Boolean) || current.loading)) return s;
      return { entries: { ...s.entries, [blockId]: { clips, loading: false, complete: true } } };
    }),
}));

/**
 * Reads the streaming NDJSON `/narrate` response and feeds clips into the shared store as they
 * arrive. Internal — callers should go through `ensureNarration` below, which adds the in-flight
 * dedup this alone doesn't provide.
 */
async function streamNarrationClips(blockId: string): Promise<NarrationClip[]> {
  const res = await api.narrate.stream(blockId);
  if (!res.body) throw new Error("Narration request failed");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const clips: NarrationClip[] = [];
  const { addClip } = useNarrationStore.getState();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const evt = JSON.parse(line) as { type: string; step?: number; audioUrl?: string; text?: string };
      if (evt.type === "clip" && typeof evt.step === "number" && evt.audioUrl) {
        const clip = { step: evt.step, audioUrl: evt.audioUrl, text: evt.text ?? "" };
        clips.push(clip);
        addClip(blockId, clip);
      }
    }
  }
  return clips;
}

/**
 * The single entry point every caller (narrate toggle, voiceover export, warm preload) should use
 * — returns the in-flight promise if one is already running for this block, otherwise starts one.
 * Resolves once every clip for the current script has streamed in.
 */
export function ensureNarration(blockId: string): Promise<NarrationClip[]> {
  const store = useNarrationStore.getState();
  const existing = store.inFlight[blockId];
  if (existing) return existing;

  const entry = store.get(blockId);
  if (entry.complete && entry.clips.some(Boolean)) {
    return Promise.resolve(entry.clips);
  }

  store.setLoading(blockId, true);
  const promise = streamNarrationClips(blockId)
    .then((clips) => {
      useNarrationStore.getState().setComplete(blockId, true);
      return clips;
    })
    .finally(() => {
      useNarrationStore.getState().setLoading(blockId, false);
      const { inFlight } = useNarrationStore.getState();
      const next = { ...inFlight };
      delete next[blockId];
      useNarrationStore.setState({ inFlight: next });
    });

  useNarrationStore.setState((s) => ({ inFlight: { ...s.inFlight, [blockId]: promise } }));
  return promise;
}
