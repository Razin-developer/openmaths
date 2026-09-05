"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Settings2,
  VideoIcon,
  Loader2,
  Volume2,
  VolumeX,
  Mic,
  FileText,
  Repeat,
  Download,
  ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DiagramErrorBoundary } from "@/components/engine/DiagramErrorBoundary";
import { BlockCanvas } from "@/components/engine/BlockCanvas";
import { HighlightableText } from "@/components/engine/HighlightableText";
import { useSceneTimeline } from "@/components/engine/useSceneTimeline";
import { buildLabelMap } from "@/lib/dsl/labelMap";
import { resolveScene, defaultVariableValues } from "@/lib/dsl/resolveScene";
import { evaluateExpr, formatExprResult } from "@/lib/dsl/expr";
import { getCanvasEl } from "@/components/engine/canvasRegistry";
import { useBlockStore } from "@/store/blockStore";
import { useBoardUiStore } from "@/store/boardUiStore";
import { useNarrationStore, ensureNarration, type NarrationClip } from "@/store/narrationStore";
import { isTypingTarget } from "@/lib/board/keyboardGuard";
import { pickVideoMimeType, recordCanvas, recordCanvasWithAudio, fetchAudioBuffer, downloadBlob, slugifyFilename } from "@/lib/board/videoExport";
import { buildStepIndex, stepForOpIndex } from "@/components/engine/timelineUtils";
import { toSpeechText } from "@/lib/board/speech";
import { PlayerScrubber, PlayerSpeedControl } from "@/components/board/nodeTypes/PlayerScrubber";
import type { Scene } from "@/lib/dsl/types";
import type { BlockData } from "@/lib/board/types";
import { api } from "@openmaths/api-client";

/** Which engine narrates each step — "hackai" (real TTS via hackai-sdk, costs a Replicate call
 * per step, supports voiceover video export) or "webapi" (free, local window.speechSynthesis, no
 * server round trip, but can't be captured into an exported video). Set via
 * NEXT_PUBLIC_TTS_PROVIDER; defaults to "hackai". */
const TTS_PROVIDER: "hackai" | "webapi" = process.env.NEXT_PUBLIC_TTS_PROVIDER === "webapi" ? "webapi" : "hackai";

function stepLabel(scene: Scene, step: number, index: number): string {
  const marker = scene.ops.find((op) => op.step === step && op.op === "step_start" && op.title);
  if (marker && marker.op === "step_start" && marker.title) return marker.title;
  const note = scene.ops.find((op) => op.step === step && op.op === "write_note");
  if (note && note.op === "write_note") return note.text.slice(0, 40);
  return `Step ${index + 1}`;
}

function stepDescription(scene: Scene, step: number): string | undefined {
  const marker = scene.ops.find((op) => op.step === step && op.op === "step_start" && op.description);
  if (marker && marker.op === "step_start") return marker.description;
  // The server-side repair pass (generate.ts's repairSceneCaptions) fills this in for almost
  // every answer, but a bare write_note is the last-resort fallback for anything that still
  // slips through — better than the caption silently going blank.
  const note = scene.ops.find((op) => op.step === step && op.op === "write_note");
  return note && note.op === "write_note" ? [note.text, note.reason].filter(Boolean).join(". ") : undefined;
}

export function GraphAnimationFullscreen({
  blockId,
  scene,
  title,
  narration,
}: {
  blockId: string;
  scene: Scene;
  /** Used only to name the downloaded video file — falls back to a generic name when omitted. */
  title?: string | null;
  /** The persisted narration cache (Block.narration) — hydrates the shared narrationStore
   * instantly on mount, no network wait, when a previous session already synthesized this exact
   * script (PRD §5.2). */
  narration?: BlockData["narration"];
}) {
  const open = useBoardUiStore((s) => s.get(blockId).fullscreen);
  const setFullscreen = useBoardUiStore((s) => s.setFullscreen);
  const timeline = useSceneTimeline(blockId, scene);
  const labelMap = useMemo(() => buildLabelMap(scene), [scene]);
  const isPlaying = timeline.status === "playing";
  const [exporting, setExporting] = useState(false);
  const [exportingVoice, setExportingVoice] = useState(false);
  const [loop, setLoop] = useState(false);

  const { firstOpIndexByStep } = useMemo(() => buildStepIndex(scene.ops), [scene]);

  /** Zeigarnik-completion / replay-rate telemetry (PRD v2 §9 "step completion") — fired once per
   * genuine, uncancelled watch-through-to-the-end, whether that happened via narrated playback
   * (runNarratedPlayback, below) or the plain (unnarrated) `timeline.play()` path (the effect
   * further down watching `timeline.status === "done"`). Deliberately NOT fired by a manual jump/
   * scrub to the last step, a step-back-then-forward, or opening a scene that happens to render
   * already at its last op — only an actual completed watch counts. */
  function trackStepCompletion(totalSteps: number) {
    api.blocks.track(blockId, { type: "STEP_COMPLETED", metadata: { totalSteps, narrated: narrate } }).catch(() => {});
  }

  const [variableValues, setVariableValues] = useState<Record<string, number>>(() => defaultVariableValues(scene));
  const [lastScene, setLastScene] = useState(scene);
  if (scene !== lastScene) {
    // Diagram regenerated (new scene object) — reset slider values to the new scene's defaults.
    // Adjusting state during render (React's documented pattern for this) instead of an effect,
    // so this doesn't cost an extra render pass.
    setLastScene(scene);
    setVariableValues(defaultVariableValues(scene));
  }
  const resolvedScene = useMemo(() => resolveScene(scene, variableValues), [scene, variableValues]);

  // Live computed results (PRD §4.4 "Values" panel) — every binding that writes a labeled op's
  // value, evaluated against the current slider values, so the args→result relationship a
  // parametric scene exists to teach is spelled out as text, not just implied by the drawing.
  const computedValues = useMemo(() => {
    if (!scene.bindings || scene.bindings.length === 0) return [];
    const byId = new Map(scene.ops.map((op) => [op.id, op]));
    const results: { label: string; value: string }[] = [];
    for (const binding of scene.bindings) {
      if (binding.expr === undefined) continue;
      const op = byId.get(binding.opId);
      const label = op && "meta" in op ? (op.meta as { label?: string } | undefined)?.label : undefined;
      if (!label) continue;
      try {
        results.push({ label, value: formatExprResult(evaluateExpr(binding.expr, variableValues)) });
      } catch {
        // Skip — a binding that fails to evaluate for the current values just isn't shown.
      }
    }
    return results;
  }, [scene, variableValues]);

  const notesByStep = useMemo(() => {
    const map = new Map<number, { text: string; reason?: string }[]>();
    for (const op of scene.ops) {
      if (op.op === "write_note") {
        const list = map.get(op.step) ?? [];
        list.push({ text: op.text, reason: op.reason });
        map.set(op.step, list);
      }
    }
    return map;
  }, [scene]);

  // A prominent caption for whatever step is currently drawing/showing — the per-step
  // title/description/notes already existed (in the sidebar), but tucked into a narrow list a
  // student has to read separately from the diagram itself explains nothing while they're
  // actually watching it draw. This surfaces the SAME text front-and-center, right where their
  // eyes already are, and optionally speaks it aloud as playback reaches each step.
  const currentStepNotes = notesByStep.get(timeline.currentStep) ?? [];
  const currentStepTitle = stepLabel(scene, timeline.currentStep, timeline.currentStepPosition);
  const currentStepDesc = stepDescription(scene, timeline.currentStep);
  const [narrate, setNarrate] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const narrationRunIdRef = useRef(0);
  const transcriptListRef = useRef<HTMLOListElement>(null);
  // Active-recall checkpoint (PRD "PRD v2 (Production)" G5 — "active-recall checkpoints").
  // Opt-IN (default off, not merely opt-out-able — the PRD's "no dark patterns" bar is easiest to
  // clear by never changing default behavior) and instantly skippable, matching the PRD's own
  // "forgiveness valve first" principle: this is a reflection PAUSE between narrated steps, never
  // a quiz, never scored, never blocking beyond one click/keypress. Scoped to narrated playback
  // only — that's the one path with a clean per-step await point; the raw (non-narrated) timeline
  // animates continuously with no natural pause boundary to hook without touching the shared
  // engine, so recall stays honestly tied to "narrate" being on.
  const [recallEnabled, setRecallEnabled] = useState(false);
  const [recallWaiting, setRecallWaiting] = useState(false);
  const recallResolveRef = useRef<(() => void) | null>(null);

  function resolveRecall() {
    recallResolveRef.current?.();
    recallResolveRef.current = null;
    setRecallWaiting(false);
  }

  /** Every place that cancels an in-progress narrated-playback loop bumps `narrationRunIdRef` —
   * route them all through here so a cancel while paused at a recall checkpoint (pause, step nav,
   * closing the player, turning narration off) always releases the wait too, instead of leaving
   * the overlay stuck with nothing left to resolve it. */
  function cancelNarration() {
    narrationRunIdRef.current += 1;
    resolveRecall();
  }

  /** Pauses narrated playback until the student dismisses the recall prompt (click/Space/Enter) —
   * resolves immediately (no-op wait) if the run was cancelled out from under it. */
  function awaitRecallCheckpoint(runId: number): Promise<void> {
    if (!recallEnabled || runId !== narrationRunIdRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      recallResolveRef.current = resolve;
      setRecallWaiting(true);
    });
  }

  // Shared store (PRD §5.1/§5.2) — every consumer (this player, the export flow, a warm preload
  // triggered from the node card) reads/writes the SAME clips for this blockId, so toggling
  // narration on/off rapidly or exporting right after enabling it can never fire more than one
  // `/narrate` synthesis pass, and clips survive this component unmounting/remounting.
  const narrationEntry = useNarrationStore((s) => s.get(blockId));
  const narrationClips = narrationEntry.clips;
  const narrationLoading = narrationEntry.loading;

  // Hydrate instantly from the DB cache on first mount, before any network request — zero-latency
  // narration for a scene a previous session already synthesized (PRD §5.2).
  const hydratedRef = useRef(false);
  if (!hydratedRef.current && narration?.clips?.length) {
    hydratedRef.current = true;
    useNarrationStore.getState().hydrate(blockId, narration.clips as NarrationClip[]);
  }

  async function toggleNarrate() {
    if (narrate) {
      setNarrate(false);
      cancelNarration(); // cancel any in-progress co-timed playback loop
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      return;
    }
    setNarrate(true);
    // webapi mode speaks locally via window.speechSynthesis — nothing to fetch, no server round
    // trip, no cost, no shared-store involvement.
    if (TTS_PROVIDER === "webapi") return;
    try {
      const clips = await ensureNarration(blockId);
      if (clips.length === 0) throw new Error("No narration clips");
    } catch {
      toast.error("Voice narration isn't available for this diagram.");
      setNarrate(false);
    }
  }

  /** Draws the step at `targetOpIndex` and (if narrating) plays its clip AT THE SAME TIME,
   * resolving only once BOTH finish — the co-timed sync PRD §4.3/§5.3 calls the single biggest
   * quality lever ("draw while speaking, finish together", not draw-then-talk). Mirrors the
   * voiceover-export flow's own Promise.all model so the live player and the exported video match. */
  function playStepCoTimed(targetOpIndex: number, clip: NarrationClip | undefined): Promise<void> {
    return new Promise((resolve) => {
      let drawDone = false;
      let audioDone = !clip || TTS_PROVIDER === "webapi";
      function checkDone() {
        if (drawDone && audioDone) resolve();
      }
      const unsubscribe = useBlockStore.subscribe((s) => {
        const status = s.blocks[blockId]?.status;
        if (status === "paused" || status === "done") {
          drawDone = true;
          unsubscribe();
          checkDone();
        }
      });
      useBlockStore.getState().playToOpIndex(blockId, targetOpIndex);

      const audio = audioRef.current;
      if (clip && audio && TTS_PROVIDER !== "webapi") {
        audio.src = clip.audioUrl;
        audio.currentTime = 0;
        audio.onended = () => {
          audioDone = true;
          checkDone();
        };
        audio.play().catch(() => {
          audioDone = true;
          checkDone();
        });
      }
    });
  }

  /** Drives narrated playback step-by-step from `startPosition` to the end, cancellable via
   * `narrationRunIdRef` (bumped by pause/step-nav/narrate-off/close so a stale loop never keeps
   * advancing after the user's taken over). */
  async function runNarratedPlayback(startPosition: number) {
    const runId = ++narrationRunIdRef.current;
    const { steps } = buildStepIndex(scene.ops);
    for (let i = startPosition; i < steps.length; i++) {
      if (runId !== narrationRunIdRef.current) return;
      const targetOpIndex = i === steps.length - 1 ? scene.ops.length : (firstOpIndexByStep.get(steps[i + 1]) ?? scene.ops.length);
      const clip = useNarrationStore.getState().get(blockId).clips[i];
      await playStepCoTimed(targetOpIndex, clip);
      if (runId !== narrationRunIdRef.current) return;
      // Pause for reflection between steps, never after the last one (nothing to predict once
      // the proof is finished).
      if (i < steps.length - 1) {
        await awaitRecallCheckpoint(runId);
        if (runId !== narrationRunIdRef.current) return;
      }
    }
    // Reached here without an early return = a genuine, uncancelled run through every step —
    // the Zeigarnik-completion telemetry signal (PRD v2 §9), fired once per natural finish
    // (including each loop lap, which is exactly what "replay rate" wants to see).
    if (runId === narrationRunIdRef.current) trackStepCompletion(steps.length);
    if (loop && runId === narrationRunIdRef.current) {
      timeline.reset();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (runId === narrationRunIdRef.current) runNarratedPlayback(0);
    }
  }

  function handlePlay() {
    if (narrate && TTS_PROVIDER !== "webapi") {
      runNarratedPlayback(timeline.currentStepPosition);
    } else {
      timeline.play();
    }
  }

  function handlePause() {
    cancelNarration();
    audioRef.current?.pause();
    timeline.pause();
  }

  function handleRestartStep() {
    cancelNarration();
    audioRef.current?.pause();
    const opIndex = firstOpIndexByStep.get(timeline.currentStep) ?? 0;
    useBlockStore.getState().jumpToOpIndex(blockId, opIndex, scene.ops.length);
    if (narrate && TTS_PROVIDER !== "webapi") {
      runNarratedPlayback(timeline.currentStepPosition);
    }
  }

  // webapi narration is a lighter-weight reactive effect (no co-timed draw/audio Promise.all
  // needed — the browser's own utterance queue handles pacing well enough, and this mode has no
  // shared store to coordinate with export).
  useEffect(() => {
    if (TTS_PROVIDER !== "webapi") return;
    if (!open || !narrate || !isPlaying) {
      window.speechSynthesis?.cancel();
      return;
    }
    const toSay = [currentStepTitle, currentStepDesc, ...currentStepNotes.map((n) => n.text)].filter(Boolean).join(". ");
    if (!toSay) return;
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(toSpeechText(toSay));
    utterance.onend = () => {
      if (isPlaying) timeline.animateStepForward();
    };
    window.speechSynthesis?.speak(utterance);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-narrate on step change, not every text/notes re-render
  }, [narrate, open, isPlaying, timeline.currentStepPosition]);

  useEffect(() => {
    if (!open) {
      // Bump the run id synchronously (a ref write, not state) so the cancelled loop's next
      // await sees it immediately; defer the recall-checkpoint setState to a microtask so this
      // effect body itself never calls setState synchronously.
      narrationRunIdRef.current += 1;
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      if (recallResolveRef.current) queueMicrotask(resolveRecall);
    }
  }, [open]);

  // Sync-highlight (PRD "Explainer Quality, Streaming Stability & Bug Sweep" §6) — publish the
  // currently-playing step position so the connected question's SolutionSteps can highlight the
  // matching line (scene step i ↔ solution step i, aligned server-side per §2). Only cleared on
  // unmount (block deleted) — deliberately NOT cleared on close, so the answer keeps showing
  // where playback last was when the student returns to the board after closing the player.
  useEffect(() => {
    if (!open) return;
    useBoardUiStore.getState().setNarratedStep(blockId, timeline.currentStepPosition);
  }, [open, blockId, timeline.currentStepPosition]);

  useEffect(() => {
    return () => useBoardUiStore.getState().setNarratedStep(blockId, null);
  }, [blockId]);

  // Step-completion tracking for the PLAIN (unnarrated) play path — narrated playback tracks its
  // own completion inside runNarratedPlayback instead (that path also eventually drives
  // timeline.status to "done", so tracking it here too would double-count the same watch-through).
  // `firedForRef` guards against re-firing on every render while status sits at "done" — only the
  // transition INTO "done" counts, reset the moment playback leaves it (replay, scrub, close).
  const firedDoneRef = useRef(false);
  useEffect(() => {
    if (narrate) return;
    if (timeline.status === "done") {
      if (!firedDoneRef.current) {
        firedDoneRef.current = true;
        trackStepCompletion(timeline.steps.length);
      }
    } else {
      firedDoneRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trackStepCompletion/timeline.steps are stable per render pass; only the status transition matters
  }, [timeline.status, narrate]);

  // Transcript auto-scroll to the active line (PRD §7 — "doesn't auto-scroll to the active line").
  useEffect(() => {
    if (!showTranscript) return;
    const list = transcriptListRef.current;
    const active = list?.querySelector<HTMLElement>(`[data-step="${timeline.currentStepPosition}"]`);
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [showTranscript, timeline.currentStepPosition]);

  async function handleExportVideo() {
    if (exporting) return;
    const canvas = getCanvasEl(blockId);
    const mimeType = pickVideoMimeType();
    if (!canvas || !mimeType) {
      toast.error("Video export isn't supported in this browser — try Chrome, Edge, or Firefox.");
      return;
    }

    setExporting(true);
    try {
      timeline.pause();
      timeline.reset();
      // Let the reset actually paint (op index 0) before capture starts, so the recording
      // doesn't open on a stale mid-animation frame.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const { stop, result } = recordCanvas(canvas, mimeType, 30);
      timeline.play();

      await new Promise<void>((resolve) => {
        const unsubscribe = useBlockStore.subscribe((s) => {
          if ((s.blocks[blockId]?.status ?? "idle") === "done") {
            unsubscribe();
            resolve();
          }
        });
      });
      // A short tail so the final frame isn't clipped by the recorder's own flush latency.
      await new Promise((resolve) => setTimeout(resolve, 500));
      stop();

      const blob = await result;
      downloadBlob(blob, `${slugifyFilename(title || "diagram")}.webm`);
      api.blocks.track(blockId, { type: "BLOCK_EXPORTED_VIDEO", metadata: { voiced: false } }).catch(() => {});
    } catch {
      toast.error("Video export failed — try again.");
    } finally {
      setExporting(false);
    }
  }

  /**
   * "Export video with voiceover" — same canvas recording as handleExportVideo, but drives the
   * animation step-by-step and mixes in the real TTS clip for each step via
   * recordCanvasWithAudio, holding each step on screen until BOTH its drawing and its narration
   * clip have finished (whichever is longer) so audio and video never fall out of sync. Goes
   * through the same shared `ensureNarration` as the live player — no duplicate synthesis if
   * narration was already toggled on before exporting.
   */
  async function handleExportVideoWithVoice() {
    if (exporting || exportingVoice) return;
    const canvas = getCanvasEl(blockId);
    const mimeType = pickVideoMimeType();
    if (!canvas || !mimeType) {
      toast.error("Video export isn't supported in this browser — try Chrome, Edge, or Firefox.");
      return;
    }

    setExportingVoice(true);
    try {
      const clips = await ensureNarration(blockId);

      timeline.pause();
      timeline.reset();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const { stop, result, audioContext, audioDestination } = recordCanvasWithAudio(canvas, mimeType, 30);
      const { steps, firstOpIndexByStep: firstOpIndexByStepLocal } = buildStepIndex(scene.ops);

      let anyClipFailed = false;
      for (let i = 0; i < steps.length; i++) {
        const targetOpIndex =
          i === steps.length - 1 ? scene.ops.length : (firstOpIndexByStepLocal.get(steps[i + 1]) ?? scene.ops.length);
        const clip = clips?.[i];

        const drawDone = new Promise<void>((resolve) => {
          const unsubscribe = useBlockStore.subscribe((s) => {
            const status = s.blocks[blockId]?.status;
            if (status === "paused" || status === "done") {
              unsubscribe();
              resolve();
            }
          });
        });
        useBlockStore.getState().playToOpIndex(blockId, targetOpIndex);

        if (clip) {
          try {
            const buffer = await fetchAudioBuffer(audioContext, clip.audioUrl);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioDestination);
            source.start();
            await Promise.all([drawDone, new Promise((resolve) => setTimeout(resolve, buffer.duration * 1000))]);
          } catch {
            anyClipFailed = true;
            await drawDone;
          }
        } else {
          await drawDone;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      stop();

      const blob = await result;
      downloadBlob(blob, `${slugifyFilename(title || "diagram")}-voiceover.webm`);
      api.blocks.track(blockId, { type: "BLOCK_EXPORTED_VIDEO", metadata: { voiced: true, anyClipFailed } }).catch(() => {});
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
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || exporting || exportingVoice) return;
      if (recallWaiting && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        resolveRecall();
        return;
      }
      switch (e.key) {
        case "Escape":
          setFullscreen(blockId, false);
          break;
        case "ArrowLeft":
          cancelNarration();
          timeline.stepBack();
          break;
        case "ArrowRight":
          cancelNarration();
          timeline.animateStepForward();
          break;
        case " ":
          e.preventDefault();
          if (isPlaying) handlePause();
          else handlePlay();
          break;
        case "Home":
          cancelNarration();
          timeline.reset();
          break;
        case "End":
          cancelNarration();
          timeline.skipToEnd();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timeline methods are stable per blockId
  }, [open, blockId, isPlaying, exporting, exportingVoice, setFullscreen, narrate, recallWaiting]);

  const totalOps = scene.ops.length;

  return (
    <Dialog open={open} onOpenChange={(next) => setFullscreen(blockId, next)}>
      <DialogContent
        className="fixed inset-0 top-0 left-0 flex h-screen w-screen max-w-none sm:max-w-none max-h-none translate-x-0 translate-y-0 flex-row gap-0 rounded-none p-0"
        showCloseButton
      >
        <DialogTitle className="sr-only">Diagram animation</DialogTitle>
        <audio ref={audioRef} className="hidden" />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <Link href="/dashboard" className="rounded-full px-2 py-1 text-[13px] font-medium tracking-tight hover:bg-accent">
              openmaths
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Step {timeline.currentStepPosition + 1} / {timeline.steps.length}
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
                    ? `Generating voice… ${narrationClips.filter(Boolean).length}/${timeline.steps.length} steps`
                    : narrate
                      ? "Narrating each step aloud as it draws"
                      : "Speak each step's explanation aloud as it draws"}
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
                <TooltipContent side="bottom">
                  {showTranscript ? "Hide narration transcript (C)" : "Show narration transcript (for a11y / no-audio reading) — C"}
                </TooltipContent>
              </Tooltip>
            </div>
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
                            onClick={() => {
                              cancelNarration();
                              timeline.scrubToStep(timeline.steps[i]);
                            }}
                            className={cn(
                              "w-full rounded px-1 py-0.5 text-left text-xs leading-snug hover:bg-accent",
                              i === timeline.currentStepPosition ? "font-medium text-foreground" : "text-muted-foreground"
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
          {(currentStepTitle || currentStepDesc || currentStepNotes.length > 0) && (
            <div className="border-b border-border bg-muted/40 px-4 py-2.5">
              <p className="text-xs font-medium">{currentStepTitle}</p>
              {currentStepDesc && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{currentStepDesc}</p>}
              {currentStepNotes.map((note, i) => (
                <p key={i} className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {note.text}
                  {note.reason && <span className="italic"> — {note.reason}</span>}
                </p>
              ))}
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            <DiagramErrorBoundary>
              <BlockCanvas blockId={blockId} scene={resolvedScene} />
            </DiagramErrorBoundary>
            {recallWaiting && (
              // Active-recall checkpoint (PRD v2 §3 G5) — a reflection pause, not a quiz: no
              // input is scored or required, the only action is dismissing it. Positioned over
              // the canvas (not blocking the transcript/sidebar) so the figure stays visible
              // while the student thinks ahead about what the next step will show.
              <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-popover px-4 py-2 shadow-lg">
                  <span className="text-xs text-foreground">Take a moment — what do you expect the next step to show?</span>
                  <Button size="sm" className="h-7 gap-1 text-xs" onClick={resolveRecall} autoFocus>
                    Continue <ChevronRight className="size-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <PlayerScrubber
            totalUnits={totalOps}
            currentUnit={timeline.currentOpIndex}
            unitProgress={timeline.opProgress}
            stepStartUnits={timeline.steps.map((step) => firstOpIndexByStep.get(step) ?? 0)}
            currentStepPosition={timeline.currentStepPosition}
            disabled={exporting || exportingVoice}
            onSeek={(opIndex) => {
              cancelNarration();
              timeline.scrubToStep(stepForOpIndex(scene, opIndex));
            }}
            onSeekStep={(stepPosition) => {
              cancelNarration();
              const step = timeline.steps[stepPosition];
              if (step !== undefined) timeline.scrubToStep(step);
            }}
          />
          {(scene.variables && scene.variables.length > 0) || computedValues.length > 0 ? (
            <div className="nodrag flex flex-col items-center gap-2 border-t border-border px-4 py-2.5">
              {scene.variables && scene.variables.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                  {scene.variables.map((variable) => (
                    <div key={variable.id} className="flex items-center gap-2">
                      <Label className="w-auto shrink-0 text-xs text-muted-foreground">{variable.label}</Label>
                      <Slider
                        value={[variableValues[variable.id] ?? variable.default]}
                        min={variable.min}
                        max={variable.max}
                        step={variable.step ?? Math.max((variable.max - variable.min) / 100, 0.01)}
                        onValueChange={([v]) => setVariableValues((prev) => ({ ...prev, [variable.id]: v }))}
                        className="w-36"
                      />
                      <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {(variableValues[variable.id] ?? variable.default).toFixed(variable.step && variable.step < 1 ? 2 : 1)}
                        {variable.unit ?? ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {computedValues.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {computedValues.map((v) => (
                    <span
                      key={v.label}
                      className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10.5px] tabular-nums text-muted-foreground"
                    >
                      {v.label} = {v.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <div className="flex items-center justify-center gap-1.5 border-t border-border py-3">
            <Button variant="ghost" size="icon-sm" onClick={timeline.reset} disabled={exporting || exportingVoice} aria-label="Restart">
              <RotateCcw className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                cancelNarration();
                timeline.stepBack();
              }}
              disabled={timeline.isFirstStep || exporting || exportingVoice}
              aria-label="Previous"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              onClick={isPlaying ? handlePause : handlePlay}
              disabled={exporting || exportingVoice}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                cancelNarration();
                timeline.stepForward();
              }}
              disabled={timeline.isLastStep || exporting || exportingVoice}
              aria-label="Next"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleRestartStep}
                  disabled={exporting || exportingVoice}
                  aria-label="Replay this step"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Replay this step</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={loop ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setLoop((v) => !v)}
                  aria-label={loop ? "Loop on" : "Loop off"}
                  aria-pressed={loop}
                >
                  <Repeat className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{loop ? "Loop: replays from the start when it finishes" : "Loop playback"}</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="ml-2 gap-0.5" disabled={exporting || exportingVoice} aria-label="Export">
                      {exporting || exportingVoice ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                      <ChevronDown className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {exporting ? "Recording the animation…" : exportingVoice ? "Recording with voiceover…" : "Export"}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="center">
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

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={exporting || exportingVoice} aria-label="Playback settings">
                  <Settings2 className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" side="top" className="w-60 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Speed</Label>
                  <PlayerSpeedControl speed={timeline.speed} onChange={timeline.setSpeed} />
                  <Slider value={[timeline.speed]} min={0.25} max={3} step={0.25} onValueChange={([v]) => timeline.setSpeed(v)} />
                </div>
                <div className="space-y-2 border-t border-border pt-2.5">
                  <Label className="text-xs">
                    Wait after each step ({timeline.stepDelay === 0 ? "off" : `${timeline.stepDelay.toFixed(1)}s`})
                  </Label>
                  <Slider
                    value={[timeline.stepDelay]}
                    min={0}
                    max={2}
                    step={0.25}
                    onValueChange={([v]) => timeline.setStepDelay(v)}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
                  <Label htmlFor="recall-toggle" className="text-xs">
                    Active recall pause
                  </Label>
                  <Switch id="recall-toggle" checked={recallEnabled} onCheckedChange={setRecallEnabled} />
                </div>
                <p className="text-[10.5px] text-muted-foreground">
                  Pauses narrated playback between steps for a moment to predict what&apos;s next — fully skippable, off by default.
                </p>
                <p className="border-t border-border pt-2.5 text-[10.5px] text-muted-foreground">
                  Keyboard: space play/pause, ← → step, Home/End restart/skip-to-end, C transcript, esc close.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="w-64 shrink-0 border-l border-border">
          <ScrollArea className="nowheel h-full">
            <div className="flex flex-col gap-1 p-3">
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">Steps</h3>
              {timeline.steps.map((step, index) => (
                <div
                  key={step}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    cancelNarration();
                    timeline.scrubToStep(step);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      cancelNarration();
                      timeline.scrubToStep(step);
                    }
                  }}
                  className={
                    "cursor-pointer rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent " +
                    (timeline.currentStepPosition === index ? "bg-accent font-medium" : "")
                  }
                >
                  <div>{stepLabel(scene, step, index)}</div>
                  {stepDescription(scene, step) && (
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      <HighlightableText text={stepDescription(scene, step)!} labelMap={labelMap} blockId={blockId} />
                    </p>
                  )}
                  {notesByStep.get(step)?.map((note, noteIndex) => (
                    <div key={noteIndex} className="mt-0.5">
                      <p className="text-xs leading-snug text-muted-foreground">
                        <HighlightableText text={note.text} labelMap={labelMap} blockId={blockId} />
                      </p>
                      {note.reason && (
                        <details className="nodrag mt-0.5" onClick={(e) => e.stopPropagation()}>
                          <summary className="cursor-pointer text-xs text-muted-foreground/70 hover:text-foreground">Why?</summary>
                          <p className="mt-0.5 pl-2 text-xs leading-snug text-muted-foreground">
                            <HighlightableText text={note.reason} labelMap={labelMap} blockId={blockId} />
                          </p>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
