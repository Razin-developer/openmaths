"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, Globe, Plus, RotateCw, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBoardUiStore } from "@/store/boardUiStore";
import type { BrowserTab } from "@/lib/board/types";

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.toString();
  } catch {
    return null;
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface TabHistory {
  stack: string[];
  index: number;
}

/**
 * A real browser chrome (tab strip, back/forward/reload, URL bar) around an iframe preview.
 * Back/forward move through OUR OWN per-tab history stack (built from URL-bar navigations, not
 * the embedded page's own in-page navigation) — an iframe can't expose a cross-origin site's
 * history to the parent page, so this is the closest approximation available. Sites that send
 * X-Frame-Options/CSP frame-ancestors headers refuse to render inside the iframe at all and fail
 * silently (no error event fires for a cross-origin frame-block) — the "Open in a new tab" button
 * next to the URL bar is the reliable fallback for those, always available rather than only
 * appearing after a guessed timeout.
 */
export function WebBrowserFullscreen({
  blockId,
  tabs,
  activeTabId,
  onTabsChange,
}: {
  blockId: string;
  tabs: BrowserTab[];
  activeTabId: string | null;
  onTabsChange: (next: BrowserTab[]) => void;
}) {
  const open = useBoardUiStore((s) => s.get(blockId).fullscreen);
  const setFullscreen = useBoardUiStore((s) => s.setFullscreen);

  const [openTabs, setOpenTabs] = useState<BrowserTab[]>(tabs);
  const [activeId, setActiveId] = useState<string | null>(activeTabId ?? tabs[0]?.id ?? null);
  const [histories, setHistories] = useState<Record<string, TabHistory>>({});
  const [reloadNonce, setReloadNonce] = useState<Record<string, number>>({});
  const [addingTab, setAddingTab] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  // Re-sync local editable state from props each time the dialog transitions closed -> open —
  // adjusting state during render (React's documented pattern for this) instead of an effect, so
  // this doesn't cost an extra render pass and doesn't trip the "setState in an effect" lint rule.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setOpenTabs(tabs);
    setActiveId(activeTabId ?? tabs[0]?.id ?? null);
    setHistories(() => {
      const next: Record<string, TabHistory> = {};
      for (const tab of tabs) next[tab.id] = { stack: [tab.url], index: 0 };
      return next;
    });
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const activeTab = openTabs.find((t) => t.id === activeId) ?? null;
  const activeHistory = activeId ? histories[activeId] : undefined;
  const currentUrl = activeHistory ? activeHistory.stack[activeHistory.index] : (activeTab?.url ?? "");

  // Same render-time-adjustment pattern: keep the URL bar's draft in sync with the active tab's
  // real current URL whenever it changes externally (tab switch, navigate, back/forward), without
  // clobbering in-progress typing (onChange updates urlDraft directly, not through this).
  const [lastSyncedUrl, setLastSyncedUrl] = useState(currentUrl);
  if (currentUrl !== lastSyncedUrl) {
    setLastSyncedUrl(currentUrl);
    setUrlDraft(currentUrl);
  }

  function persistTabs(next: BrowserTab[]) {
    setOpenTabs(next);
    onTabsChange(next);
  }

  function navigate(tabId: string, rawUrl: string) {
    const url = normalizeUrl(rawUrl);
    if (!url) return;
    setHistories((prev) => {
      const current = prev[tabId] ?? { stack: [url], index: -1 };
      const stack = [...current.stack.slice(0, current.index + 1), url];
      return { ...prev, [tabId]: { stack, index: stack.length - 1 } };
    });
    persistTabs(openTabs.map((t) => (t.id === tabId ? { ...t, url } : t)));
  }

  function goBack() {
    if (!activeId) return;
    setHistories((prev) => {
      const h = prev[activeId];
      if (!h || h.index <= 0) return prev;
      return { ...prev, [activeId]: { ...h, index: h.index - 1 } };
    });
  }

  function goForward() {
    if (!activeId) return;
    setHistories((prev) => {
      const h = prev[activeId];
      if (!h || h.index >= h.stack.length - 1) return prev;
      return { ...prev, [activeId]: { ...h, index: h.index + 1 } };
    });
  }

  function reload() {
    if (!activeId) return;
    setReloadNonce((prev) => ({ ...prev, [activeId]: (prev[activeId] ?? 0) + 1 }));
  }

  function closeTab(tabId: string) {
    const next = openTabs.filter((t) => t.id !== tabId);
    persistTabs(next);
    if (activeId === tabId) setActiveId(next[0]?.id ?? null);
    if (next.length === 0) setFullscreen(blockId, false);
  }

  function addTab() {
    const url = normalizeUrl(urlDraft);
    if (!url) return;
    const id = crypto.randomUUID();
    const newTab: BrowserTab = { id, url, title: null, favicon: null };
    const next = [...openTabs, newTab];
    persistTabs(next);
    setHistories((prev) => ({ ...prev, [id]: { stack: [url], index: 0 } }));
    setActiveId(id);
    setAddingTab(false);
    setUrlDraft("");
  }

  const iframeKey = useMemo(
    () => `${activeId ?? "none"}-${currentUrl}-${reloadNonce[activeId ?? ""] ?? 0}`,
    [activeId, currentUrl, reloadNonce]
  );

  return (
    <Dialog open={open} onOpenChange={(next) => setFullscreen(blockId, next)}>
      <DialogContent
        className="fixed inset-0 top-0 left-0 flex h-screen w-screen max-w-none sm:max-w-none max-h-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Web browser</DialogTitle>

        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          <Link href="/dashboard" className="mr-1 shrink-0 rounded-full px-2 py-1 text-[13px] font-medium tracking-tight hover:bg-accent">
            openmaths
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {openTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveId(tab.id)}
                className={
                  "group flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 border-border px-2.5 py-1.5 text-xs " +
                  (tab.id === activeId ? "bg-background font-medium" : "bg-muted text-muted-foreground hover:bg-accent")
                }
              >
                {tab.favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external favicon
                  <img src={tab.favicon} alt="" className="size-3.5 shrink-0 rounded-sm" />
                ) : (
                  <Globe className="size-3.5 shrink-0" />
                )}
                <span className="max-w-32 truncate">{tab.title || hostnameOf(tab.url)}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }
                  }}
                  aria-label="Close tab"
                  className="rounded-full p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100"
                >
                  <X className="size-3" />
                </span>
              </button>
            ))}
            {addingTab ? (
              <Input
                autoFocus
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTab();
                  if (e.key === "Escape") setAddingTab(false);
                }}
                onBlur={() => !urlDraft && setAddingTab(false)}
                placeholder="https://…"
                className="h-7 w-40 shrink-0 text-xs"
              />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" className="shrink-0" onClick={() => setAddingTab(true)} aria-label="New tab">
                    <Plus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New tab</TooltipContent>
              </Tooltip>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setFullscreen(blockId, false)} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          <Button variant="ghost" size="icon-sm" onClick={goBack} disabled={!activeHistory || activeHistory.index <= 0} aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={goForward}
            disabled={!activeHistory || activeHistory.index >= activeHistory.stack.length - 1}
            aria-label="Forward"
          >
            <ArrowRight className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={reload} disabled={!activeId} aria-label="Reload">
            <RotateCw className="size-4" />
          </Button>
          <Input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && activeId) navigate(activeId, urlDraft);
            }}
            className="h-8 flex-1 text-xs"
            placeholder="https://…"
          />
          {currentUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" asChild>
                  <a href={currentUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open in a new tab — some sites block being embedded here and only load this way
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="min-h-0 flex-1 bg-background">
          {currentUrl ? (
            <iframe
              key={iframeKey}
              src={currentUrl}
              title={activeTab?.title || hostnameOf(currentUrl)}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No page open — add a tab to get started.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
