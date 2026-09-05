import type { Scene } from "../dsl/types";
import type { MessageAttachment } from "../ai/attachments";
import type { SolutionStep, TableForm, Form } from "../ai/envelope";

export type BlockStatus = "DRAFT" | "GENERATING" | "READY" | "ERROR";
export type BlockKind = "QUESTION" | "SUB_QUESTION" | "GRAPH" | "NOTE" | "LINK";
export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export interface MessageData {
  id: string;
  role: MessageRole;
  content: string;
  attachments?: MessageAttachment[] | null;
  /** Structured reasoning steps for a multi-step ASSISTANT answer — see SolutionStepSchema. */
  solution?: SolutionStep[] | null;
  /** The pinned final result string, present alongside `solution`. */
  finalAnswer?: string | null;
  /** A DOM/KaTeX table form, present when the answer includes tabular data — see TableForm. */
  table?: TableForm | null;
  /** PRD v2 §5 — the Form architecture. An ordered ALTERNATIVE to solution/table above, present
   * only when the answer genuinely needed more than one diagram/table or a non-default content
   * order; renders via FormRenderer instead of the flat solution/table/scene rendering when set. */
  forms?: Form[] | null;
  createdAt: string;
}

export interface BrowserTab {
  id: string;
  url: string;
  title?: string | null;
  favicon?: string | null;
}

export interface BlockData {
  id: string;
  canvasId: string;
  parentBlockId: string | null;
  kind: BlockKind;
  status: BlockStatus;
  title: string | null;
  prompt: string;
  modelId: string | null;
  reasoningEffort: string | null;
  scene: Scene | null;
  /** GRAPH blocks only — cached narration clips ({voice, scriptHash, clips}), see ai/tts.ts /
   * narrate/route.ts. Used to hydrate the shared narrationStore instantly on mount instead of
   * always waiting on a network round trip (PRD "Fullscreen Player & Animation UX" §5.2). */
  narration?: { voice: string; scriptHash: string; clips: { step: number; audioUrl: string; text: string }[] } | null;
  errorMessage: string | null;
  positionX: number;
  positionY: number;
  messages: MessageData[];
  /** LINK-kind blocks only — open browser tabs (see BrowserTab). Null/empty/omitted for a
   * single-page link created before multi-tab support, in which case `prompt` is the one page. */
  tabs?: BrowserTab[] | null;
}

export interface ConnectionData {
  id: string;
  canvasId: string;
  sourceBlockId: string;
  targetBlockId: string;
  label: string | null;
}

export interface CanvasData {
  id: string;
  title: string;
  blocks: BlockData[];
  connections: ConnectionData[];
}
