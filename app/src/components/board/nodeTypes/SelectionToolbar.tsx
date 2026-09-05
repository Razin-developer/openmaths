"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircleQuestion, GitBranch, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const VIEWPORT_MARGIN = 8;

export function SelectionToolbar({
  onAskSameChat,
  onAskNewChat,
  isUser,
  children,
}: {
  onAskSameChat: (selection: string) => void;
  onAskNewChat: (selection: string) => void;
  isUser: boolean;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // `anchor` is the raw selection-rect point from mouseup; `style` is the clamped, viewport-safe
  // left/top actually rendered — computed separately (see the layout effect below) once the
  // toolbar's real size is known, so it can never render half off-screen near an edge.
  const [anchor, setAnchor] = useState<{ x: number; y: number; text: string } | null>(null);
  const [style, setStyle] = useState<{ left: number; top: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleMouseUp() {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || !selection || selection.rangeCount === 0) {
        setAnchor(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const container = containerRef.current;
      if (!container || !container.contains(range.commonAncestorContainer)) {
        setAnchor(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setAnchor({ x: rect.left + rect.width / 2, y: rect.top, text });
    }

    // The toolbar is positioned from a one-time getBoundingClientRect() snapshot — it has no way
    // to track the selection as the page scrolls or the window resizes, so it would otherwise
    // drift away from the text it's supposed to point at. Dismissing on either is simpler and
    // more honest than trying to reposition against an arbitrary number of nested scroll
    // containers (the board canvas, a message list, etc.) — the user can just re-select.
    function handleScrollOrResize() {
      setAnchor(null);
    }
    function handleSelectionChange() {
      const text = window.getSelection()?.toString().trim();
      if (!text) setAnchor(null);
    }

    document.addEventListener("mouseup", handleMouseUp);
    // Touch selection has no "mouseup" — selectionchange is what fires when a long-press
    // selection is made/adjusted, so this also covers the touch case (§5's "premium: also
    // trigger on touch selectionchange").
    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, []);

  // Clamp into the viewport once the toolbar has actually rendered and its real size is known —
  // flips below the selection if there's no room above (e.g. a selection near the top edge)
  // instead of letting it render partially off-screen.
  useLayoutEffect(() => {
    if (!anchor || !toolbarRef.current) {
      setStyle(null);
      return;
    }
    const rect = toolbarRef.current.getBoundingClientRect();
    let left = anchor.x - rect.width / 2;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - rect.width - VIEWPORT_MARGIN);

    let top = anchor.y - rect.height - 6;
    if (top < VIEWPORT_MARGIN) top = anchor.y + 20; // flip below the selection
    top = Math.min(Math.max(top, VIEWPORT_MARGIN), window.innerHeight - rect.height - VIEWPORT_MARGIN);

    setStyle({ left, top });
  }, [anchor]);

  return (
    <div ref={containerRef} className={isUser ? "flex justify-end" : "flex justify-start"}>
      {children}
      {anchor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={toolbarRef}
            className="fixed z-50 flex items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-md"
            style={style ? { left: style.left, top: style.top } : { left: anchor.x, top: anchor.y, visibility: "hidden" }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={async () => {
                await navigator.clipboard.writeText(anchor.text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />} Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={() => {
                onAskSameChat(anchor.text);
                setAnchor(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              <MessageCircleQuestion className="size-3" /> Ask (this chat)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={() => {
                onAskNewChat(anchor.text);
                setAnchor(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              <GitBranch className="size-3" /> Ask (new chat)
            </Button>
          </div>,
          document.body
        )}
    </div>
  );
}
