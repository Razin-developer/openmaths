import type { MessageContent, PdfPlugin } from "@razinmohammedpt/hackai-sdk";

export interface MessageAttachment {
  type: "image" | "file" | "voice_transcript" | "annotation";
  name?: string;
  /** data: URI — image/PDF content. Absent for voice_transcript/annotation (their text is folded into the message text instead). */
  dataUrl?: string;
  /** Quoted source text — only set for annotation attachments (selected text the user attached via "Ask"). */
  text?: string;
}

/**
 * Builds the outgoing ChatMessage content for a user turn, folding in image/file
 * attachments as hackai-sdk's multi-part content shape when present, and quoting any
 * annotation attachments (selected text attached via "Ask") directly into the text.
 */
export function buildUserContent(
  text: string,
  attachments: MessageAttachment[] = []
): { content: MessageContent; plugins?: PdfPlugin[] } {
  const annotations = attachments.filter((a) => a.type === "annotation" && a.text);
  const quotedText =
    annotations.length > 0
      ? `${annotations.map((a) => `> ${a.text}`).join("\n\n")}\n\n${text}`
      : text;

  const mediaAttachments = attachments.filter((a) => a.type !== "voice_transcript" && a.type !== "annotation" && a.dataUrl);
  if (mediaAttachments.length === 0) {
    return { content: quotedText };
  }

  const content: MessageContent = [{ type: "text", text: quotedText }];
  let needsPdfPlugin = false;

  for (const attachment of mediaAttachments) {
    if (attachment.type === "image" && attachment.dataUrl) {
      content.push({ type: "image_url", image_url: { url: attachment.dataUrl } });
    } else if (attachment.type === "file" && attachment.dataUrl) {
      content.push({
        type: "file",
        file: { filename: attachment.name ?? "document.pdf", file_data: attachment.dataUrl },
      });
      needsPdfPlugin = true;
    }
  }

  return {
    content,
    plugins: needsPdfPlugin ? [{ id: "file-parser", pdf: { engine: "pdf-text" } }] : undefined,
  };
}

/** Type guard-ish helper: is this ChatMessage content just plain text? */
export function contentToPlainText(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}
