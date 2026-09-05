import { create } from "zustand";
import type { MessageAttachment } from "@/lib/ai/attachments";

interface AnnotationStore {
  pending: Record<string, MessageAttachment[]>;
  addPending: (blockId: string, attachments: MessageAttachment[]) => void;
  removeAt: (blockId: string, index: number) => void;
  /** Clears a block's pending annotations once they've been sent. */
  clear: (blockId: string) => void;
}

export const useAnnotationStore = create<AnnotationStore>((set) => ({
  pending: {},
  addPending: (blockId, attachments) =>
    set((s) => ({
      pending: { ...s.pending, [blockId]: [...(s.pending[blockId] ?? []), ...attachments] },
    })),
  removeAt: (blockId, index) =>
    set((s) => ({
      pending: { ...s.pending, [blockId]: (s.pending[blockId] ?? []).filter((_, i) => i !== index) },
    })),
  clear: (blockId) =>
    set((s) => {
      const rest = { ...s.pending };
      delete rest[blockId];
      return { pending: rest };
    }),
}));
