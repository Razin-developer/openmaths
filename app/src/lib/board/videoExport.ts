/** Picks the best-supported WebM codec for MediaRecorder — canvas video export works in any
 * Chromium/Firefox browser but MediaRecorder itself (and WebM specifically) isn't universally
 * supported (notably older Safari), so callers must handle a null return by disabling export. */
export function pickVideoMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugifyFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "diagram"
  );
}

/**
 * Records a canvas element's live output to a WebM video via MediaRecorder + captureStream.
 * `signal.stop()` (or the returned controller's own `stop()`) finalizes the recording; the
 * promise resolves with the encoded blob once the recorder has flushed its last chunk.
 */
export function recordCanvas(
  canvas: HTMLCanvasElement,
  mimeType: string,
  fps = 30
): { stop: () => void; result: Promise<Blob> } {
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const result = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  recorder.start();

  return {
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
    },
    result,
  };
}

/**
 * Like `recordCanvas`, but also mixes in a live audio track — used for "Export video with
 * voiceover" (PRD §7.6). The caller drives narration playback by decoding each clip into the
 * returned `audioContext` and connecting an `AudioBufferSourceNode` to `audioDestination`
 * (see `fetchAudioBuffer` below); this file stays a dumb AV-plumbing layer and doesn't know
 * anything about steps/narration timing itself.
 */
export function recordCanvasWithAudio(
  canvas: HTMLCanvasElement,
  mimeType: string,
  fps = 30
): {
  stop: () => void;
  result: Promise<Blob>;
  audioContext: AudioContext;
  audioDestination: MediaStreamAudioDestinationNode;
} {
  const audioContext = new AudioContext();
  const audioDestination = audioContext.createMediaStreamDestination();

  const videoStream = canvas.captureStream(fps);
  const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);

  const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const result = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      for (const track of videoStream.getTracks()) track.stop();
      for (const track of audioDestination.stream.getTracks()) track.stop();
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  recorder.start();

  return {
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
      if (audioContext.state !== "closed") audioContext.close().catch(() => {});
    },
    result,
    audioContext,
    audioDestination,
  };
}

/** Fetches and decodes a narration clip so it can be played through an `AudioContext` graph
 * (rather than an `<audio>` element, whose `captureStream` output is subject to stricter
 * cross-origin taint rules that would silently mute a Replicate-hosted clip in the recording). */
export async function fetchAudioBuffer(audioContext: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch narration clip: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}
