"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { toast } from "sonner";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Loader2,
  FileText,
  Settings2,
  Download,
  ChevronDown,
  VideoIcon,
  Mic,
} from "lucide-react";
import type { Components } from "react-markdown";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isTypingTarget } from "@/lib/board/keyboardGuard";
import { toSpeechText } from "@/lib/board/speech";
import { useNarrationStore, ensureNarration } from "@/store/narrationStore";
import { PlayerScrubber, PlayerSpeedControl } from "@/components/board/nodeTypes/PlayerScrubber";
import {
  pickVideoMimeType,
  recordCanvas,
  recordCanvasWithAudio,
  fetchAudioBuffer,
  downloadBlob,
  slugifyFilename,
} from "@/lib/board/videoExport";
import { drawTextSlide } from "@/lib/board/textCanvasRenderer";
import type { SolutionStep, TableForm } from "@/lib/ai/envelope";
import { api } from "@openmaths/api-client";

const TTS_PROVIDER: "hackai" | "webapi" = process.env.NEXT_PUBLIC_TTS_PROVIDER === "webapi" ? "webapi" : "hackai";
/** Seconds each step holds on screen when auto-playing WITHOUT narration — scaled by `speed`
 * exactly like the diagram player's op durations are. With narration on, the step instead holds
 * for however long its clip actually takes (audio-gated, same principle as the diagram player). */
const BASE_STEP_HOLD_SECONDS = 3;

const markdownComponents: Components = {
  p: ({ children }) => <span>{children}</span>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
};

function Md({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  );
}

interface StepContent {
  /** Rendered large, front-and-center — the one idea this step is about. */
  headline: React.ReactNode;
  /** Rendered smaller below the headline — the working/detail, if any. */
  detail?: React.ReactNode;
  reason?: string;
  /** Plain-text equivalents of headline/detail (LaTeX spoken out, markdown stripped, via the same
   * `toSpeechText` narration already uses) — there's no live DOM/KaTeX to rasterize for video
   * export, so these are what actually get drawn onto the export canvas (textCanvasRenderer.ts). */
  plainHeadline: string;
  plainDetail?: string;
}

function stepsFromSolution(solution: SolutionStep[]): StepContent[] {
  return solution.map((s) => ({
    headline: <Md text={s.claim} />,
    detail: s.detail ? <Md text={s.detail} /> : undefined,
    reason: s.reason,
    plainHeadline: toSpeechText(s.claim),
    plainDetail: s.detail ? toSpeechText(s.detail) : undefined,
  }));
}

function stepsFromTable(table: TableForm): StepContent[] {
  return table.rows.map((row, i) => ({
    headline: (
      <span className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
        {row.map((cell, j) => (
          <span key={j} className="inline-flex items-baseline gap-1.5">
            <span className="text-sm text-muted-foreground">{table.headers[j] ?? `col ${j + 1}`}</span>
            <span className="rounded-md border border-border bg-background px-2 py-0.5 font-medium">
              <Md text={cell} />
            </span>
          </span>
        ))}
      </span>
    ),
    detail: i === 0 && table.caption ? <span className="text-muted-foreground">{table.caption}</span> : undefined,
    plainHeadline: row.map((cell, j) => `${table.headers[j] ?? `column ${j + 1}`}: ${toSpeechText(cell)}`).join("  ·  "),
    plainDetail: i === 0 && table.caption ? table.caption : undefined,
  }));
}

/**
 * The fullscreen "stepped reader" for narratable forms that have no diagram — `solution_steps`
 * and `table` (PRD "Fullscreen Player & Animation UX" §3). Reuses the same scrubber/speed chrome
 * as `GraphAnimationFullscreen` (`PlayerScrubber`/`PlayerSpeedControl`) and the same shared
 * narration store/`/narrate` route, just with a plain step index driving playback instead of the
 * WebGL op-tick engine — there's no drawing to sync to, only "hold this step, then advance".
 * Video export works too: each step is drawn as a plain-text slide onto a hidden canvas
 * (`textCanvasRenderer.ts`) so `recordCanvas`/`recordCanvasWithAudio` have something real to
 * capture — there's no live scene to animate, so this is a slideshow, not a drawing animation.
 */
export function FullscreenPlayer({
  blockId,
  solution,
  table,
  finalAnswer,
}: {
  blockId: string;
  solution?: SolutionStep[] | null;
  table?: TableForm | null;
  finalAnswer?: string | null;
}) {
  const steps: StepContent[] = solution && solution.length > 0 ? stepsFromSolution(solution) : table ? stepsFromTable(table) : [];

  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [narrate, setNarrate] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportingVoice, setExportingVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runIdRef = useRef(0);
  const transcriptListRef = useRef<HTMLOListElement>(null);

  const narrationEntry = useNarrationStore((s) => s.get(blockId));
  const narrationClips = narrationEntry.clips;
  const narrationLoading = narrationEntry.loading;

  async function toggleNarrate() {
    if (narrate) {
      setNarrate(false);
      return;
    }
    setNarrate(true);
    if (TTS_PROVIDER === "webapi") return;
    try {
      await ensureNarration(blockId);
    } catch {
      setNarrate(false);
    }
  }

  /** Holds on `index` for however long is appropriate — the step's real clip duration when
   * narrating (audio-gated, mirrors the diagram player's co-timed model), or a fixed,
   * speed-scaled duration otherwise — then resolves so the caller can advance. */
  function holdStep(index: number): Promise<void> {
    return new Promise((resolve) => {
      const clip = narrate && TTS_PROVIDER !== "webapi" ? narrationClips[index] : undefined;
      const audio = audioRef.current;
      if (clip && audio) {
        audio.src = clip.audioUrl;
        audio.currentTime = 0;
        audio.onended = () => resolve();
        audio.play().catch(() => resolve());
      } else {
        // No cleanup needed for the timer itself — the run-id check in the caller loop already
        // makes a stale resolution after cancellation a no-op (nothing awaits it anymore).
        setTimeout(resolve, (BASE_STEP_HOLD_SECONDS * 1000) / speed);
      }
    });
  }

  async function runPlayback(from: number) {
    const runId = ++runIdRef.current;
    for (let i = from; i < steps.length; i++) {
      if (runId !== runIdRef.current) return;
      setCurrentStep(i);
      await holdStep(i);
      if (runId !== runIdRef.current) return;
    }
    if (runId === runIdRef.current) setPlaying(false);
  }

  function handlePlay() {
    setPlaying(true);
    runPlayback(currentStep >= steps.length - 1 ? 0 : currentStep);
  }

  function handlePause() {
    runIdRef.current++;
    audioRef.current?.pause();
    setPlaying(false);
  }

  function seekTo(index: number) {
    runIdRef.current++;
    audioRef.current?.pause();
    setCurrentStep(Math.max(0, Math.min(steps.length - 1, index)));
    if (playing) runPlayback(index);
  }

  useEffect(() => {
    return () => {
      // Cancels any in-progress playback loop on unmount — incrementing whatever the ref holds
      // at cleanup time is exactly the intended behavior here, not a stale-closure read.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runIdRef.current++;
      window.speechSynthesis?.cancel();
    };
  }, []);

  function slideFor(index: number): { headline: string; detail?: string; stepLabel: string; finalAnswer?: string } {
    const s = steps[index];
    return {
      headline: s.plainHeadline,
      detail: s.plainDetail,
      stepLabel: `Step ${index + 1} / ${steps.length}`,
      finalAnswer: index === steps.length - 1 && finalAnswer ? finalAnswer : undefined,
    };
  }

  /** Silent video export — draws each step as a text slide on a hidden canvas, holding a fixed
   * duration per step, and records the canvas exactly like the diagram player's own silent
   * export does (`recordCanvas`). There's no live scene to animate, so this is a slideshow rather
   * than a drawing animation — the closest honest equivalent for a text-only form. */
  async function handleExportVideo() {
    if (exporting || exportingVoice) return;
    const canvas = canvasRef.current;
    const mimeType = pickVideoMimeType();
    if (!canvas || !mimeType) {
      toast.error("Video export isn't supported in this browser — try Chrome, Edge, or Firefox.");
      return;
    }
    setExporting(true);
    try {
      drawTextSlide(canvas, slideFor(0));
      const { stop, result } = recordCanvas(canvas, mimeType, 10);
      for (let i = 0; i < steps.length; i++) {
        drawTextSlide(canvas, slideFor(i));
        await new Promise((resolve) => setTimeout(resolve, (BASE_STEP_HOLD_SECONDS * 1000) / speed));
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
      stop();
      const blob = await result;
      downloadBlob(blob, `${slugifyFilename("answer")}.webm`);
      api.blocks
        .track(blockId, { type: "BLOCK_EXPORTED_VIDEO", metadata: { voiced: false, form: solution ? "solution_steps" : "table" } })
        .catch(() => {});
    } catch {
      toast.error("Video export failed — try again.");
    } finally {
      setExporting(false);
    }
  }

  /** Voiceover export — same text-slide canvas, but each slide holds until its narration clip
   * actually finishes (co-timed, same Promise.all model the diagram player's voiceover export
   * uses), with the audio mixed in via `recordCanvasWithAudio`. */
  async function handleExportVideoWithVoice() {
    if (exporting || exportingVoice) return;
    const canvas = canvasRef.current;
    const mimeType = pickVideoMimeType();
    if (!canvas || !mimeType) {
      toast.error("Video export isn't supported in this browser — try Chrome, Edge, or Firefox.");
      return;
    }
    setExportingVoice(true);
    try {
      const clips = await ensureNarration(blockId);
      drawTextSlide(canvas, slideFor(0));
      const { stop, result, audioContext, audioDestination } = recordCanvasWithAudio(canvas, mimeType, 10);

      let anyClipFailed = false;
      for (let i = 0; i < steps.length; i++) {
        drawTextSlide(canvas, slideFor(i));
        const clip = clips[i];
        if (clip) {
          try {
            const buffer = await fetchAudioBuffer(audioContext, clip.audioUrl);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioDestination);
            source.start();
            await new Promise((resolve) => setTimeout(resolve, buffer.duration * 1000));
          } catch {
            anyClipFailed = true;
            await new Promise((resolve) => setTimeout(resolve, (BASE_STEP_HOLD_SECONDS * 1000) / speed));
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, (BASE_STEP_HOLD_SECONDS * 1000) / speed));
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
      stop();
      const blob = await result;
      downloadBlob(blob, `${slugifyFilename("answer")}-voiceover.webm`);
      api.blocks
        .track(blockId, { type: "BLOCK_EXPORTED_VIDEO", metadata: { voiced: true, anyClipFailed, form: solution ? "solution_steps" : "table" } })
        .catch(() => {});
      if (anyClipFailed) {
        toast.error("Some narration clips couldn't be included — the video still exported.");
      }
    } catch {
      toast.error("Video export with voiceover failed — try again.");
    } finally {
      setExportingVoice(false);
    }
  }

  useEffect(() => {
    if (!showTranscript) return;
    const active = transcriptListRef.current?.querySelector<HTMLElement>(`[data-step="${currentStep}"]`);
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [showTranscript, currentStep]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      switch (e.key) {
        case "ArrowLeft":
          seekTo(currentStep - 1);
          break;
        case "ArrowRight":
          seekTo(currentStep + 1);
          break;
        case " ":
          e.preventDefault();
          if (playing) handlePause();
          else handlePlay();
          break;
        case "Home":
          seekTo(0);
          break;
        case "End":
          seekTo(steps.length - 1);
          break;
        case "c":
        case "C":
          setShowTranscript((v) => !v);
          break;
        default:
          return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-bind on step/playing change only
  }, [currentStep, playing, steps.length]);

  if (steps.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Nothing to play back for this answer.</p>;
  }

  const step = steps[currentStep];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <audio ref={audioRef} className="hidden" />
      {/* Off-screen but NOT display:none — some browsers stop producing captureStream() frames
          for a canvas that's removed from layout entirely, so this stays positioned (just far
          outside the viewport) rather than hidden via display:none. */}
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed top-0 left-[-9999px]" />
      <div className="flex items-center justify-end gap-2 border-b border-border px-3 py-2">
        <span className="text-xs text-muted-foreground">
          Step {currentStep + 1} / {steps.length}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={narrate ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={toggleNarrate}
              disabled={narrationLoading}
              aria-label={narrate ? "Turn off narration" : "Narrate steps aloud"}
              aria-pressed={narrate}
            >
              {narrationLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : narrate ? (
                <Volume2 className="size-4" />
              ) : (
                <VolumeX className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {narrationLoading
              ? `Generating voice… ${narrationClips.filter(Boolean).length}/${steps.length} steps`
              : narrate
                ? "Narrating each step aloud"
                : "Speak each step aloud"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showTranscript ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setShowTranscript((v) => !v)}
              aria-label={showTranscript ? "Hide transcript" : "Show transcript"}
              aria-pressed={showTranscript}
            >
              <FileText className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{showTranscript ? "Hide transcript (C)" : "Show transcript — C"}</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="gap-0.5" disabled={exporting || exportingVoice} aria-label="Export">
                  {exporting || exportingVoice ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {exporting ? "Recording…" : exportingVoice ? "Recording with voiceover…" : "Export"}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportVideo} disabled={exporting || exportingVoice} className="text-xs">
              <VideoIcon className="size-3.5" /> Video (.webm)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportVideoWithVoice}
              disabled={exporting || exportingVoice || TTS_PROVIDER === "webapi"}
              className="text-xs"
            >
              <Mic className="size-3.5" /> Video + voiceover
              {TTS_PROVIDER === "webapi" && <span className="ml-auto text-[10px]">needs hackai TTS</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showTranscript && (
        <div className="max-h-40 overflow-y-auto border-b border-border bg-muted/20 px-4 py-2.5">
          {narrationClips.filter(Boolean).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Turn on narration to generate a transcript — it fills in as each step&rsquo;s voice line is synthesized.
            </p>
          ) : (
            <ol ref={transcriptListRef} className="space-y-1">
              {narrationClips.map(
                (clip, i) =>
                  clip && (
                    <li key={i} data-step={i}>
                      <button
                        type="button"
                        onClick={() => seekTo(i)}
                        className={cn(
                          "w-full rounded px-1 py-0.5 text-left text-xs leading-snug hover:bg-accent",
                          i === currentStep ? "font-medium text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <span className="tabular-nums">{i + 1}.</span> {clip.text}
                      </button>
                    </li>
                  )
              )}
            </ol>
          )}
        </div>
      )}

      <ScrollArea className="nowheel min-h-0 flex-1">
        <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="max-w-xl text-lg font-medium">{step.headline}</div>
          {step.detail && <div className="max-w-xl text-muted-foreground">{step.detail}</div>}
          {step.reason && (
            <details className="nodrag mt-1">
              <summary className="cursor-pointer text-xs text-muted-foreground/70 hover:text-foreground">Why?</summary>
              <p className="mt-1 max-w-xl text-xs leading-snug text-muted-foreground">
                <Md text={step.reason} />
              </p>
            </details>
          )}
          {currentStep === steps.length - 1 && finalAnswer && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium">
              <span className="text-muted-foreground">Answer:</span>
              <Md text={finalAnswer} />
            </p>
          )}
        </div>
      </ScrollArea>

      <PlayerScrubber
        totalUnits={steps.length}
        currentUnit={currentStep}
        unitProgress={0}
        stepStartUnits={steps.map((_, i) => i)}
        currentStepPosition={currentStep}
        onSeek={seekTo}
        onSeekStep={seekTo}
        disabled={exporting || exportingVoice}
      />

      <div className="flex items-center justify-center gap-1.5 border-t border-border py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => seekTo(currentStep - 1)}
          disabled={currentStep === 0 || exporting || exportingVoice}
          aria-label="Previous"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          onClick={playing ? handlePause : handlePlay}
          disabled={exporting || exportingVoice}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => seekTo(currentStep + 1)}
          disabled={currentStep === steps.length - 1 || exporting || exportingVoice}
          aria-label="Next"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="ml-2" disabled={exporting || exportingVoice} aria-label="Playback settings">
              <Settings2 className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" side="top" className="w-56 space-y-2">
            <Label className="text-xs">Speed (when not narrating)</Label>
            <PlayerSpeedControl speed={speed} onChange={setSpeed} />
            <p className="border-t border-border pt-2 text-[10.5px] text-muted-foreground">
              Keyboard: space play/pause, ← → step, Home/End restart/skip-to-end, C transcript.
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
