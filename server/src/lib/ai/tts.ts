// Mirrors app's src/lib/ai/tts.ts (PRD "Split into app + server" — duplicated per-process rather
// than shared via a package, same call already made for ai/client.ts: this touches
// HACKCLUB_AI_API_KEY directly via process.env, a secret that must stay server-only, and has no
// Prisma dependency to justify packages/db either).

/** Single fixed voice for ALL narration — the PRD forbids any user-facing voice/model picker
 * (Settings, player, or export UI all use this same id). Confirmed valid, along with the
 * `{text, voice_id}` input shape, via a live spike before this module was written. */
export const TTS_VOICE = "Friendly_Person";

/** A rough model identifier for usage-log rows — labels the "By model" breakdown in
 * Settings > Usage; never resolves to a cost figure (neither Replicate's API nor HCAI's proxy
 * expose a dollar cost or per-second hardware price for a prediction, only wall-clock timing). */
export const TTS_MODEL_ID = "minimax/speech-02-turbo";

const REPLICATE_BASE = "https://ai.hackclub.com/proxy/v1/replicate";

/** hackai-sdk v2.0.0's `replicate.tts.speechTurbo()` (and the whole `run(model, input)` escape
 * hatch it's built on) creates predictions via `POST /predictions` with a resolved `{version}` —
 * that path started rejecting every request with "Could not validate model access. Please
 * provide the 'model' field..." (verified live, not model-specific — every `replicate.*` helper
 * in the SDK shares this same broken path). Hack Club AI's proxy now only accepts the model-
 * scoped shortcut, `POST /models/{owner}/{name}/predictions` with no version at all (verified
 * live: 400 on the SDK's path, 201 on this one, same input). This bypasses the SDK's `replicate`
 * resource entirely and talks to that endpoint directly — a self-contained create+poll, since the
 * SDK doesn't expose one that fits. Revisit whenever a newer hackai-sdk release re-fixes this
 * upstream (checked at fix time: 2.0.0 is current-latest and still broken). */
async function runReplicateModel(model: string, input: Record<string, unknown>): Promise<unknown> {
  const apiKey = process.env.HACKCLUB_AI_API_KEY;
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const createRes = await fetch(`${REPLICATE_BASE}/models/${model}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ input }),
  });
  if (!createRes.ok) {
    throw new Error(`Replicate prediction create failed (${createRes.status}): ${await createRes.text()}`);
  }
  let prediction = await createRes.json();

  // Poll until terminal — the proxy has no webhook support here, so this is the only option.
  // 500ms between polls, capped at 60s total (TTS clips are short; this is a generous ceiling).
  const deadline = Date.now() + 60_000;
  while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled") {
    if (Date.now() > deadline) throw new Error("Replicate prediction timed out waiting for a result");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const pollRes = await fetch(`${REPLICATE_BASE}/predictions/${prediction.id}`, { headers });
    if (!pollRes.ok) throw new Error(`Replicate prediction poll failed (${pollRes.status}): ${await pollRes.text()}`);
    prediction = await pollRes.json();
  }
  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error ?? "no error detail"}`);
  }
  return prediction.output;
}

function extractAudioUrl(output: unknown): string | null {
  if (output === null || output === undefined) return null;
  // Replicate's TTS models return either a bare URL string or a single-element array of one —
  // handle both rather than assuming a shape that might differ per model.
  const candidate = Array.isArray(output) ? output[0] : output;
  const url = String(candidate);
  return url.startsWith("http") ? url : null;
}

/** Synthesizes one clip of speech and returns its hosted, directly-playable audio URL — Replicate
 * hosts the file on its own delivery CDN, so there's nothing to upload or store locally. */
export async function synthesizeSpeech(text: string): Promise<string> {
  const output = await runReplicateModel(TTS_MODEL_ID, { text, voice_id: TTS_VOICE });
  const url = extractAudioUrl(output);
  if (!url) throw new Error("TTS returned no audio URL");
  return url;
}
