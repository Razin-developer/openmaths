/**
 * Best-effort model capability table. hackai-sdk's models.list() only returns bare model ids —
 * it exposes no modality metadata — so this is a small hand-maintained map of known model id
 * substrings to what they're likely to support, used only to gate the attachment UI (disable
 * buttons + explain why) and give a clear server-side error rather than a silent bad request.
 * NOT ground truth: unknown models default to "text only," and known models may drift over time.
 */
interface ModelCapabilities {
  vision: boolean;
  pdf: boolean;
}

const KNOWN_CAPABILITIES: Array<{ match: string; capabilities: ModelCapabilities }> = [
  { match: "gemini", capabilities: { vision: true, pdf: true } },
  { match: "gpt-4", capabilities: { vision: true, pdf: true } },
  { match: "gpt-5", capabilities: { vision: true, pdf: true } },
  { match: "claude", capabilities: { vision: true, pdf: true } },
  { match: "qwen3-vl", capabilities: { vision: true, pdf: false } },
  { match: "qwen2.5-vl", capabilities: { vision: true, pdf: false } },
  { match: "llama-4", capabilities: { vision: true, pdf: false } },
  { match: "pixtral", capabilities: { vision: true, pdf: false } },
];

const DEFAULT_CAPABILITIES: ModelCapabilities = { vision: false, pdf: false };

export function getModelCapabilities(modelId: string | null | undefined): ModelCapabilities {
  if (!modelId) return DEFAULT_CAPABILITIES;
  const lower = modelId.toLowerCase();
  const found = KNOWN_CAPABILITIES.find((entry) => lower.includes(entry.match));
  return found?.capabilities ?? DEFAULT_CAPABILITIES;
}
