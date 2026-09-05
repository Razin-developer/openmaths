import type { BlockData, BrowserTab } from "./types";
import type { Scene } from "../dsl/types";

/** Prisma's Block shape as returned raw by our API routes (dates as strings after JSON transport). */
export function apiBlockToBlockData(raw: Record<string, unknown>): BlockData {
  return {
    id: raw.id as string,
    canvasId: raw.canvasId as string,
    parentBlockId: (raw.parentBlockId as string | null) ?? null,
    kind: raw.kind as BlockData["kind"],
    status: raw.status as BlockData["status"],
    title: (raw.title as string | null) ?? null,
    prompt: (raw.prompt as string) ?? "",
    modelId: (raw.modelId as string | null) ?? null,
    reasoningEffort: (raw.reasoningEffort as string | null) ?? null,
    scene: (raw.scene as Scene | null) ?? null,
    narration: (raw.narration as BlockData["narration"]) ?? null,
    errorMessage: (raw.errorMessage as string | null) ?? null,
    tabs: Array.isArray(raw.tabs) ? (raw.tabs as BrowserTab[]) : null,
    positionX: (raw.positionX as number) ?? 0,
    positionY: (raw.positionY as number) ?? 0,
    messages: Array.isArray(raw.messages)
      ? (raw.messages as Record<string, unknown>[]).map((m) => ({
          id: m.id as string,
          role: m.role as BlockData["messages"][number]["role"],
          content: m.content as string,
          attachments: m.attachments as BlockData["messages"][number]["attachments"],
          solution: m.solution as BlockData["messages"][number]["solution"],
          finalAnswer: (m.finalAnswer as string | null) ?? null,
          table: m.table as BlockData["messages"][number]["table"],
          forms: m.forms as BlockData["messages"][number]["forms"],
          createdAt: m.createdAt as string,
        }))
      : [],
  };
}
