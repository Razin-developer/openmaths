import { useStreamingStore } from "@/store/streamingStore";
import { api } from "@openmaths/api-client";

export type StreamEvent =
  | { type: "start"; userMessage: Record<string, unknown> }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "status"; phase: "diagram" }
  | {
      type: "done";
      block: Record<string, unknown>;
      graphBlock?: Record<string, unknown> | null;
      graphConnection?: Record<string, unknown> | null;
      // PRD v2 §5 forms[] — populated instead of graphBlock/graphConnection when a message's
      // forms carry MORE THAN ONE geometry/plot diagram (the common single-diagram case, whether
      // from the flat scene field or a single-form forms[] entry, still uses graphBlock/
      // graphConnection above so existing consumers need no changes). Each entry mirrors the
      // singular pair's shape.
      graphSyncs?: { graphBlock: Record<string, unknown>; graphConnection: Record<string, unknown> }[];
      webLinkBlock?: Record<string, unknown> | null;
      webLinkConnection?: Record<string, unknown> | null;
      webLinkSkipped?: { url: string; reason: string }[];
    }
  | { type: "error"; block: Record<string, unknown>; error: string };

/** Reads the NDJSON stream from POST /api/blocks/[id]/messages, dispatching each parsed event. */
export async function streamMessages(
  blockId: string,
  content: string,
  attachments: { type: string; name?: string; dataUrl?: string }[] | undefined,
  onEvent: (event: StreamEvent) => void,
  options?: { casual?: boolean; webSearch?: boolean; skillId?: string }
) {
  const res = await api.messages.stream(blockId, {
    content,
    attachments,
    casual: options?.casual,
    webSearch: options?.webSearch,
    skillId: options?.skillId,
    // Stable per logical send — lets the server dedupe the billing write if this exact request
    // ever gets retried (PRD "User System" §4.3 idempotency). Not reused across separate sends.
    requestId: crypto.randomUUID(),
  });
  // A non-2xx (e.g. 429 rate-limited) already threw ApiError above, with its message extracted
  // from the JSON error body — nothing further to check here before reading the NDJSON stream.
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as StreamEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as StreamEvent);
}

/**
 * Same as streamMessages, but also mirrors delta/reset/status events into the shared
 * streamingStore keyed by blockId — so ANY component watching that block (not just whoever
 * initiated the request) sees live streaming text, e.g. a Question node auto-created and
 * streamed into from a Note's "Ask AI" action.
 */
export async function streamToBlock(
  blockId: string,
  content: string,
  attachments: { type: string; name?: string; dataUrl?: string }[] | undefined,
  onEvent: (event: StreamEvent) => void,
  options?: { casual?: boolean; webSearch?: boolean; skillId?: string }
) {
  const store = useStreamingStore.getState();
  store.start(blockId);
  try {
    await streamMessages(
      blockId,
      content,
      attachments,
      (event) => {
        if (event.type === "delta") store.appendDelta(blockId, event.text);
        else if (event.type === "reset") store.reset(blockId);
        else if (event.type === "status" && event.phase === "diagram") store.setPhase(blockId, "diagram");
        onEvent(event);
      },
      options
    );
  } finally {
    store.clear(blockId);
  }
}
