import type { MessageAttachment } from "./attachments";

/** PRD "Auth & Security Audit" F9 — attachments/voice arrive as base64 data URLs in a JSON body
 * with no prior size limit at all: a giant payload could DoS the request handler (JSON parsing +
 * Postgres write) and, worse, gets forwarded straight to a billed model/STT call. These caps are
 * generous for legitimate use (a scanned homework photo, a few-page PDF, a short voice note) and
 * cheap to check — base64 length gives an exact byte count without decoding. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB per image/file attachment
export const MAX_ATTACHMENTS_PER_MESSAGE = 4;
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15MB — a few minutes of voice at typical bitrates

/** Exact decoded byte size of a `data:...;base64,AAAA` URI, without allocating the decoded bytes. */
function dataUrlByteSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return 0;
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Returns an error message if the attachments array violates a limit, or null if it's fine. */
export function validateAttachments(attachments: MessageAttachment[]): string | null {
  if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return `Too many attachments — up to ${MAX_ATTACHMENTS_PER_MESSAGE} per message.`;
  }
  for (const a of attachments) {
    if (a.dataUrl && dataUrlByteSize(a.dataUrl) > MAX_ATTACHMENT_BYTES) {
      return `"${a.name ?? "attachment"}" is too large — attachments are limited to ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB.`;
    }
  }
  return null;
}

/** Same size check for a single voice-note data URL (transcribe route — one clip per request). */
export function validateAudioDataUrl(dataUrl: string): string | null {
  if (dataUrlByteSize(dataUrl) > MAX_AUDIO_BYTES) {
    return `Voice note is too large — limited to ${MAX_AUDIO_BYTES / 1024 / 1024}MB.`;
  }
  return null;
}
