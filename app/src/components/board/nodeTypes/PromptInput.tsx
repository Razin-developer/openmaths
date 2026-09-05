"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Globe,
  Mic,
  Square,
  X,
  Quote,
  Sparkles,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { EffortPicker, type ReasoningLevel } from "@/components/board/nodeTypes/EffortPicker";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { getModelCapabilities } from "@/lib/ai/modelCapabilities";
import type { MessageAttachment } from "@/lib/ai/attachments";
import type { BlockData, BlockKind } from "@/lib/board/types";
import { NodeTypeIcon } from "@/components/board/nodeTypes/NodeTypeIcon";
import { useAnnotationStore } from "@/store/annotationStore";
import { blobToWavDataUrl } from "@/lib/board/audioEncode";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@openmaths/api-client";

export interface Mentionable {
  kind: BlockKind;
  title: string;
}

interface SkillOption {
  id: string;
  name: string;
  description: string;
}

// PRD "Split into app + server" P3-continued — cut over to the base-URL client; /skills is now
// ported to `server`.
async function fetchSkills(): Promise<SkillOption[]> {
  try {
    const { skills } = await api.skills.list();
    return skills;
  } catch {
    return [];
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Stable reference for the "no pending annotations" case — a fresh `[]` literal on every
// selector call would make zustand's snapshot look like it changes every render, causing
// an infinite update loop ("getSnapshot should be cached").
const EMPTY_ANNOTATIONS: MessageAttachment[] = [];

/** Matches a live "/query" or "@query" trigger ending at the cursor (start of string or after whitespace). */
function matchTrigger(text: string, cursor: number): { type: "/" | "@"; query: string; start: number } | null {
  const upToCursor = text.slice(0, cursor);
  const match = upToCursor.match(/(?:^|\s)([/@])(\w*)$/);
  if (!match) return null;
  const start = upToCursor.length - match[2].length - 1;
  return { type: match[1] as "/" | "@", query: match[2], start };
}

export function PromptInput({
  block,
  autoFocus,
  onReasoningEffortChange,
  onSend,
  mentionables,
}: {
  block: BlockData;
  autoFocus?: boolean;
  onReasoningEffortChange: (effort: ReasoningLevel) => void;
  onSend: (
    content: string,
    attachments?: MessageAttachment[],
    options?: { webSearch?: boolean; skillId?: string }
  ) => Promise<void>;
  /** Every connected node (diagram, note, web browser) offered as an @ mention target. */
  mentionables?: Mentionable[];
}) {
  const [value, setValue] = useState("");
  const [fileAttachments, setFileAttachments] = useState<MessageAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [activeSkill, setActiveSkill] = useState<{ id: string; name: string } | null>(null);
  const [trigger, setTrigger] = useState<{ type: "/" | "@"; query: string; start: number } | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const disabled = block.status === "GENERATING";
  // PRD v2 §G6 "Production hardening" — offline states. Typing stays enabled while offline (no
  // reason to block composing a question), only sending is gated — paired with OfflineBanner.tsx's
  // global banner so the "why is Send greyed out" question always has a visible answer nearby.
  const online = useOnlineStatus();
  const capabilities = getModelCapabilities(block.modelId);
  const reasoningLevel = (block.reasoningEffort as ReasoningLevel) ?? "medium";

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // `disabled` (derived from block.status) only reflects a send-in-flight once the parent has
  // re-rendered with the new status — a fast double Enter-press (or a held key's OS-level repeat)
  // can call handleSend a second time inside that gap, before React commits the update, firing two
  // identical requests. This ref is set synchronously on the first call, closing that gap.
  const sendingRef = useRef(false);

  const { data: skills } = useQuery({ queryKey: ["skills"], queryFn: fetchSkills, staleTime: 5 * 60 * 1000 });

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const annotations = useAnnotationStore((s) => s.pending[block.id] ?? EMPTY_ANNOTATIONS);

  const filteredSkills = (skills ?? []).filter((s) =>
    s.name.toLowerCase().includes((trigger?.query ?? "").toLowerCase())
  );
  const filteredMentions = (mentionables ?? []).filter((m) =>
    m.title.toLowerCase().includes((trigger?.query ?? "").toLowerCase())
  );

  function handleValueChange(next: string, cursor: number) {
    setValue(next);
    const match = matchTrigger(next, cursor);
    if (match && match.type === "@" && (!mentionables || mentionables.length === 0)) {
      setTrigger(null);
    } else {
      setTrigger(match);
      setHighlightIndex(0);
    }
  }

  function selectSkill(skill: SkillOption) {
    if (trigger) {
      const before = value.slice(0, trigger.start);
      const after = value.slice(trigger.start + 1 + trigger.query.length);
      setValue(`${before}${after}`.trimStart());
    }
    setActiveSkill({ id: skill.id, name: skill.name });
    setTrigger(null);
    textareaRef.current?.focus();
  }

  function selectMention(title: string) {
    if (trigger) {
      const before = value.slice(0, trigger.start);
      const after = value.slice(trigger.start + 1 + trigger.query.length);
      setValue(`${before}@${title} ${after}`);
    }
    setTrigger(null);
    textareaRef.current?.focus();
  }

  async function handleSend() {
    const content = value.trim();
    if (!content || disabled || sendingRef.current) return;
    sendingRef.current = true;
    setValue("");
    setTrigger(null);
    const toSend = [...annotations, ...fileAttachments];
    setFileAttachments([]);
    useAnnotationStore.getState().clear(block.id);
    try {
      await onSend(content, toSend.length > 0 ? toSend : undefined, { webSearch, skillId: activeSkill?.id });
    } finally {
      sendingRef.current = false;
    }
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setFileAttachments((prev) => [...prev, { type, name: file.name, dataUrl }]);
  }

  function removeFileAttachment(index: number) {
    setFileAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function removeAnnotation(index: number) {
    useAnnotationStore.getState().removeAt(block.id, index);
  }

  async function transcribeAndInsert(dataUrl: string) {
    setTranscribing(true);
    try {
      const { transcript } = await api.blocks.transcribe(block.id, dataUrl);
      setValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
    } catch (err) {
      // Specific, actionable message from the route (§9.1.4) with a one-click retry — re-runs
      // transcription on the SAME already-recorded audio, no need to record again.
      const message =
        err instanceof ApiError ? err.message : "Couldn't reach the transcription service — check your connection.";
      toast.error(message, { action: { label: "Retry", onClick: () => transcribeAndInsert(dataUrl) } });
    } finally {
      setTranscribing(false);
    }
  }

  async function handleVoiceClick() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setRecordingSeconds(0);
        if (audioChunksRef.current.length === 0) return;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        try {
          // Transcode to WAV via the Web Audio API regardless of what MediaRecorder actually
          // captured (webm/opus, ogg, mp4 — varies by browser) — the STT model is confirmed to
          // accept WAV, so this sidesteps guessing at codec support entirely.
          const wavDataUrl = await blobToWavDataUrl(blob);
          await transcribeAndInsert(wavDataUrl);
        } catch {
          toast.error("Couldn't process that recording — try again.");
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access was denied");
    }
  }

  const triggerOptions: { key: string; label: string }[] =
    trigger?.type === "/"
      ? filteredSkills.map((s) => ({ key: s.id, label: s.name }))
      : trigger?.type === "@"
        ? filteredMentions.map((m) => ({ key: m.title, label: m.title }))
        : [];
  const showTriggerPopover = trigger !== null && triggerOptions.length > 0;
  const safeHighlight = Math.min(highlightIndex, Math.max(triggerOptions.length - 1, 0));

  function selectHighlighted() {
    if (trigger?.type === "/") {
      const skill = filteredSkills[safeHighlight];
      if (skill) selectSkill(skill);
    } else if (trigger?.type === "@") {
      const mention = filteredMentions[safeHighlight];
      if (mention) selectMention(mention.title);
    }
  }

  return (
    <div className="nodrag relative rounded-md border border-border bg-background">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFilePicked(e, "image")}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handleFilePicked(e, "file")}
      />

      {/* Portalled to document.body (Radix Popover) instead of a hand-rolled absolute div — a
          plain `absolute` child would be clipped by this node card's `overflow-hidden` (needed
          for rounded corners + the WebGL canvas) and could render under neighboring nodes. The
          Anchor wraps the whole card below so the menu is positioned relative to the input, not
          just the textarea; `open` is driven by trigger state rather than a click, and focus is
          kept on the textarea (onOpenAutoFocus prevented) so typing keeps filtering the list. */}
      <Popover open={showTriggerPopover} onOpenChange={(next) => { if (!next) setTrigger(null); }}>
        <PopoverAnchor asChild>
          <div className="flex flex-col">
            {(annotations.length > 0 || fileAttachments.length > 0 || activeSkill) && (
        <div className="flex flex-wrap gap-1 px-1.5 pt-1.5">
          {activeSkill && (
            <span className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
              <Sparkles className="size-2.5" />
              {activeSkill.name}
              <button onClick={() => setActiveSkill(null)} aria-label="Remove skill">
                <X className="size-2.5" />
              </button>
            </span>
          )}
          {annotations.map((a, i) => (
            <span
              key={`annotation-${i}`}
              className="flex max-w-48 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              <Quote className="size-2.5 shrink-0" />
              <span className="truncate">{a.text}</span>
              <button onClick={() => removeAnnotation(i)} aria-label="Remove annotation" className="shrink-0">
                <X className="size-2.5" />
              </button>
            </span>
          ))}
          {fileAttachments.map((a, i) => (
            <span
              key={`file-${i}`}
              className="flex max-w-48 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {a.type === "image" ? (
                <ImageIcon className="size-2.5 shrink-0" />
              ) : (
                <FileText className="size-2.5 shrink-0" />
              )}
              <span className="truncate">{a.name ?? a.type}</span>
              <button onClick={() => removeFileAttachment(i)} aria-label="Remove attachment" className="shrink-0">
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleValueChange(e.target.value, e.target.selectionStart)}
        onKeyDown={(e) => {
          if (showTriggerPopover) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlightIndex((i) => Math.min(i + 1, triggerOptions.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              selectHighlighted();
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setTrigger(null);
              return;
            }
            return;
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          } else if (e.key === "Escape" && trigger) {
            setTrigger(null);
          }
        }}
        placeholder={
          transcribing
            ? "Transcribing…"
            : block.messages.length === 0
              ? "Ask a math question… ( / for a skill, @ for a diagram)"
              : "Reply…"
        }
        autoFocus={autoFocus}
        disabled={disabled}
        className="min-h-[52px] resize-none border-none text-xs shadow-none focus-visible:ring-0"
      />

      <div className="flex items-center justify-between gap-1 px-1.5 pb-1.5">
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Attach">
                <Paperclip className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                disabled={!capabilities.vision}
                onClick={() => imageInputRef.current?.click()}
                className="text-xs"
              >
                <ImageIcon className="size-3" /> Image
                {!capabilities.vision && <span className="ml-auto text-[10px]">unsupported</span>}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!capabilities.pdf}
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                <FileText className="size-3" /> File (PDF)
                {!capabilities.pdf && <span className="ml-auto text-[10px]">unsupported</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={recording ? "destructive" : "ghost"}
            size="icon-xs"
            onClick={handleVoiceClick}
            aria-label={recording ? `Stop recording (${recordingSeconds}s)` : "Record voice"}
            className={cn(recording && "gap-1 px-1.5 w-auto")}
          >
            {recording ? <Square className="size-3" /> : <Mic className="size-3" />}
            {recording && (
              <span className="text-[10px] tabular-nums" aria-hidden="true">
                {String(Math.floor(recordingSeconds / 60)).padStart(1, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
              </span>
            )}
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={webSearch ? "secondary" : "ghost"}
                size="icon-xs"
                onClick={() => setWebSearch((v) => !v)}
                aria-label="Toggle web search"
                aria-pressed={webSearch}
              >
                <Globe className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {webSearch ? "Web search on — answers will use live search results" : "Search the web for this answer"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeSkill ? "secondary" : "ghost"}
                size="icon-xs"
                onClick={() => {
                  const next = `${value}${value && !value.endsWith(" ") ? " " : ""}/`;
                  handleValueChange(next, next.length);
                  requestAnimationFrame(() => {
                    textareaRef.current?.focus();
                    textareaRef.current?.setSelectionRange(next.length, next.length);
                  });
                }}
                aria-label="Pick a skill"
                className={cn(activeSkill && "text-secondary-foreground")}
              >
                <Sparkles className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Skill — style preset for this answer</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1">
          <EffortPicker value={reasoningLevel} onChange={onReasoningEffortChange} />
          {online ? (
            <Button size="icon-sm" onClick={handleSend} disabled={disabled || recording || !value.trim()} aria-label="Send">
              <ArrowUp className="size-3.5" />
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* A disabled native button swallows pointer events, so Radix's Tooltip never sees
                    the hover — wrap it in a span (which stays hoverable) so the tooltip still
                    shows why Send is greyed out instead of just going silent. */}
                <span>
                  <Button size="icon-sm" disabled aria-label="Send (offline)">
                    <ArrowUp className="size-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">You&apos;re offline — reconnect to send</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="nodrag w-56 p-1"
        >
          {trigger?.type === "/"
            ? filteredSkills.map((skill, i) => (
                <button
                  key={skill.id}
                  onClick={() => selectSkill(skill)}
                  onMouseEnter={() => setHighlightIndex(i)}
                  className={cn(
                    "flex w-full flex-col items-start rounded-sm px-2 py-1 text-left",
                    i === safeHighlight ? "bg-accent" : "hover:bg-accent"
                  )}
                >
                  <span className="text-xs">{skill.name}</span>
                  <span className="text-[10px] text-muted-foreground">{skill.description}</span>
                </button>
              ))
            : filteredMentions.map((m, i) => (
                <button
                  key={m.title}
                  onClick={() => selectMention(m.title)}
                  onMouseEnter={() => setHighlightIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-xs",
                    i === safeHighlight ? "bg-accent" : "hover:bg-accent"
                  )}
                >
                  <NodeTypeIcon kind={m.kind} />
                  {m.title}
                </button>
              ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
