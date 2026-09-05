"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  Link2,
  Code,
  Quote,
  Eye,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useBoardUiStore } from "@/store/boardUiStore";
import { markdownComponents } from "@/lib/board/markdown";
import { api, ApiError } from "@openmaths/api-client";

interface Wrapper {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  before: string;
  after?: string;
  linePrefix?: boolean;
}

const WRAPPERS: Wrapper[] = [
  { label: "Bold", icon: Bold, before: "**", after: "**" },
  { label: "Italic", icon: Italic, before: "_", after: "_" },
  { label: "Strikethrough", icon: Strikethrough, before: "~~", after: "~~" },
  { label: "Heading", icon: Heading2, before: "## ", linePrefix: true },
  { label: "Bullet list", icon: List, before: "- ", linePrefix: true },
  { label: "Numbered list", icon: ListOrdered, before: "1. ", linePrefix: true },
  { label: "Quote", icon: Quote, before: "> ", linePrefix: true },
  { label: "Code", icon: Code, before: "`", after: "`" },
  { label: "Link", icon: Link2, before: "[", after: "](https://)" },
];

export function NoteFullscreen({
  blockId,
  content,
  onChange,
  canEdit,
}: {
  blockId: string;
  content: string;
  onChange: (next: string) => void;
  /** Viewer/Commenter get a read-only editor here (PRD §7's "read-only board" — this fullscreen
   * dialog had been the one editing surface that wasn't actually gated: the toolbar, textarea,
   * and "Ask AI to write" all worked regardless of role, even though the PATCH that persists a
   * keystroke was already server-rejected — the edit just silently never saved). */
  canEdit: boolean;
}) {
  const open = useBoardUiStore((s) => s.get(blockId).fullscreen);
  const setFullscreen = useBoardUiStore((s) => s.setFullscreen);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(content);
  const [preview, setPreview] = useState(!canEdit);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  async function handleAskAi() {
    const instruction = aiPrompt.trim();
    if (!instruction || aiBusy) return;
    setAiBusy(true);
    try {
      const { text } = await api.blocks.writeNote(blockId, { instruction, currentContent: value });
      const next = value.trim() ? `${value.trim()}\n\n${text}` : text;
      setValue(next);
      onChange(next);
      setAiPrompt("");
      setAiOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't reach the server — check your connection and try again");
    } finally {
      setAiBusy(false);
    }
  }

  function applyWrapper(wrapper: Wrapper) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    let next: string;
    let cursorStart: number;
    let cursorEnd: number;

    if (wrapper.linePrefix) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      next = value.slice(0, lineStart) + wrapper.before + value.slice(lineStart);
      cursorStart = start + wrapper.before.length;
      cursorEnd = end + wrapper.before.length;
    } else {
      const selected = value.slice(start, end);
      const after = wrapper.after ?? "";
      next = value.slice(0, start) + wrapper.before + selected + after + value.slice(end);
      cursorStart = start + wrapper.before.length;
      cursorEnd = cursorStart + selected.length;
    }

    setValue(next);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function handleChange(next: string) {
    setValue(next);
    onChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => setFullscreen(blockId, next)}>
      <DialogContent
        className="fixed inset-0 top-0 left-0 flex h-screen w-screen max-w-none sm:max-w-none max-h-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Note editor</DialogTitle>
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <Link href="/dashboard" className="rounded-full px-2 py-1 text-[13px] font-medium tracking-tight hover:bg-accent">
            openmaths
          </Link>
          <div className="flex items-center gap-1.5">
            {canEdit && (
              <ButtonGroup>
                {WRAPPERS.map((wrapper) => (
                  <Tooltip key={wrapper.label}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => applyWrapper(wrapper)}
                        disabled={preview}
                        aria-label={wrapper.label}
                      >
                        <wrapper.icon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{wrapper.label}</TooltipContent>
                  </Tooltip>
                ))}
              </ButtonGroup>
            )}
            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={preview ? "secondary" : "outline"}
                    size="icon-sm"
                    onClick={() => setPreview((p) => !p)}
                    aria-label={preview ? "Edit" : "Preview"}
                    aria-pressed={preview}
                  >
                    {preview ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {preview ? "Back to editing" : "Preview — see it styled, no markdown characters"}
                </TooltipContent>
              </Tooltip>
            )}
            {canEdit && (
              <Popover open={aiOpen} onOpenChange={setAiOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon-sm" aria-label="Ask AI to write">
                        <Sparkles className="size-3.5" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Ask AI to write or expand this note</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" className="w-72 space-y-2">
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAskAi();
                      }
                    }}
                    placeholder="e.g. Write an intro explaining what a derivative is…"
                    className="min-h-16 text-xs"
                    autoFocus
                  />
                  <Button size="sm" className="w-full text-xs" onClick={handleAskAi} disabled={aiBusy || !aiPrompt.trim()}>
                    {aiBusy ? "Writing…" : "Write into note"}
                  </Button>
                </PopoverContent>
              </Popover>
            )}
            {!canEdit && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                View only
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setFullscreen(blockId, false)} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        {preview ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-6 text-sm leading-relaxed md:mx-auto md:w-full md:max-w-3xl">
            {value.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                {value}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            readOnly={!canEdit}
            placeholder={canEdit ? "Write your note in Markdown…" : "Nothing here yet."}
            className="min-h-0 flex-1 resize-none rounded-none border-none p-6 text-sm leading-relaxed shadow-none focus-visible:ring-0 md:mx-auto md:max-w-3xl"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
