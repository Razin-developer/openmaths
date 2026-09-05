"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Expand, Globe, LayoutGrid, List, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBoardContext } from "@/components/board/boardContext";
import { useBoardUiStore } from "@/store/boardUiStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeleteNodeButton } from "@/components/board/nodeTypes/DeleteNodeButton";
import { NodeTitleEditor } from "@/components/board/nodeTypes/NodeTitleEditor";
import { NodeTypeIcon } from "@/components/board/nodeTypes/NodeTypeIcon";
import { WebBrowserFullscreen } from "@/components/board/nodeTypes/WebBrowserFullscreen";
import { ScrollBottomFade } from "@/components/board/nodeTypes/ScrollBottomFade";
import { useAutoGrowHeight } from "@/components/board/nodeTypes/useAutoGrowHeight";
import { useCollapseHeight } from "@/components/board/nodeTypes/useCollapseHeight";
import type { BrowserTab } from "@/lib/board/types";
import { api } from "@openmaths/api-client";
import {
  DEFAULT_NODE_HEIGHT,
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_LINK_NODE_HEIGHT,
  MIN_LINK_NODE_WIDTH,
  type QuestionFlowNode,
} from "@/components/board/Board";

const SCROLL_BOTTOM_THRESHOLD_PX = 48;
// Header (~37px) + the tab list's own vertical padding (2 x 10px) — no footer here.
const LINK_CHROME_HEIGHT = 57;

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

/** Falls back to a single legacy tab for links created before multi-tab support. */
function tabsFor(prompt: string, tabs: BrowserTab[] | null | undefined): BrowserTab[] {
  if (tabs && tabs.length > 0) return tabs;
  if (prompt) return [{ id: "legacy", url: prompt, title: null, favicon: null }];
  return [];
}

// PRD "Performance Audit & Answer-Rendering Fix" B2 — unmemoized, so any unrelated board
// re-render re-rendered every web-browser node regardless of viewport visibility.
export const WebLinkNode = memo(function WebLinkNode({ id, data, selected }: NodeProps<QuestionFlowNode>) {
  const { block } = data;
  const ctx = useBoardContext();
  const setFullscreen = useBoardUiStore((s) => s.setFullscreen);
  const fullscreenOpen = useBoardUiStore((s) => s.get(id).fullscreen);
  const setManuallyResized = useBoardUiStore((s) => s.setManuallyResized);
  const manuallyResized = useBoardUiStore((s) => s.get(id).manuallyResized);
  const layout = useBoardUiStore((s) => s.get(id).layout);
  const toggleCollapsed = useBoardUiStore((s) => s.toggleCollapsed);
  const collapsed = layout === "collapsed";
  useCollapseHeight(id, collapsed, DEFAULT_NODE_HEIGHT);
  const tabs = tabsFor(block.prompt, block.tabs);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [adding, setAdding] = useState(tabs.length === 0);
  const [draft, setDraft] = useState("");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showScrollFade, setShowScrollFade] = useState(false);
  useAutoGrowHeight(id, contentRef, {
    chromeHeight: LINK_CHROME_HEIGHT,
    minHeight: MIN_LINK_NODE_HEIGHT,
    maxHeight: MAX_NODE_HEIGHT,
    enabled: !manuallyResized && !collapsed,
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function handleScroll() {
      const distanceFromBottom = el!.scrollHeight - el!.scrollTop - el!.clientHeight;
      setShowScrollFade(distanceFromBottom > SCROLL_BOTTOM_THRESHOLD_PX);
    }
    handleScroll();
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [tabs.length, view, adding]);

  async function persistTabs(next: BrowserTab[]) {
    ctx.updateBlock(id, { tabs: next, prompt: next[0]?.url ?? "" });
    await api.blocks.update(id, { tabs: next, prompt: next[0]?.url ?? "" }).catch(() => {});
  }

  async function handleAddTab() {
    const url = normalizeUrl(draft);
    if (!url) {
      toast.error("Enter a valid URL");
      return;
    }
    if (tabs.some((t) => t.url === url)) {
      setDraft("");
      setAdding(false);
      return;
    }
    setDraft("");
    setAdding(false);

    const newTab: BrowserTab = { id: crypto.randomUUID(), url, title: null, favicon: null };
    const next = [...tabs, newTab];
    await persistTabs(next);

    api.linkPreview
      .check(url)
      .then((preview) => {
        if (!preview.ok) {
          toast.error(`${preview.hostname ?? url} — ${preview.status ? `site returned ${preview.status}` : "site can't be reached"}`);
        }
        const withPreview = next.map((t) =>
          t.id === newTab.id ? { ...t, title: preview.title ?? null, favicon: preview.favicon ?? null } : t
        );
        persistTabs(withPreview);
        if (!block.title && preview.title && tabs.length === 0) {
          ctx.updateBlock(id, { title: preview.title });
          api.blocks.update(id, { title: preview.title }).catch(() => {});
        }
      })
      .catch(() => {});
  }

  function handleRemoveTab(tabId: string) {
    persistTabs(tabs.filter((t) => t.id !== tabId));
  }

  function openTab(tabId: string) {
    setActiveTabId(tabId);
    setFullscreen(id, true);
  }

  async function handleDelete() {
    await api.blocks.remove(id).catch(() => {});
    ctx.removeNode(id);
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        collapsed && "h-auto"
      )}
      style={collapsed ? undefined : { maxHeight: MAX_NODE_HEIGHT }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <NodeResizer
        isVisible={selected && !collapsed}
        minWidth={MIN_LINK_NODE_WIDTH}
        minHeight={MIN_LINK_NODE_HEIGHT}
        maxWidth={MAX_NODE_WIDTH}
        maxHeight={MAX_NODE_HEIGHT}
        onResize={() => setManuallyResized(id)}
        handleClassName="!size-2.5 !rounded-full !border !border-border !bg-background"
        lineClassName="!border-foreground/20"
      />
      <Handle type="source" position={Position.Right} className="!bg-foreground/40" />
      <Handle type="target" position={Position.Left} className="!bg-foreground/40" />

      <div className="drag-handle flex cursor-grab items-center justify-between gap-1 border-b border-border px-2.5 py-1.5 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-1">
          <NodeTypeIcon kind={block.kind} />
          <NodeTitleEditor blockId={id} title={block.title || "Web Browser"} />
        </div>
        <div className="nodrag flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => toggleCollapsed(id, () => {})}
                aria-label={collapsed ? "Expand" : "Collapse"}
              >
                {collapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{collapsed ? "Expand" : "Collapse"}</TooltipContent>
          </Tooltip>
          {!collapsed && tabs.length > 0 && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
                    aria-label={view === "grid" ? "Switch to list view" : "Switch to grid view"}
                  >
                    {view === "grid" ? <LayoutGrid className="size-3" /> : <List className="size-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{view === "grid" ? "Switch to list view" : "Switch to grid view"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" onClick={() => setAdding(true)} aria-label="Add tab">
                    <Plus className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Add tab</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => (fullscreenOpen ? setFullscreen(id, false) : openTab(tabs[0].id))}
                    aria-label={fullscreenOpen ? "Exit fullscreen" : "Fullscreen"}
                  >
                    <Expand className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{fullscreenOpen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
              </Tooltip>
            </>
          )}
          {ctx.canEdit && <DeleteNodeButton label="this web browser" onConfirm={handleDelete} />}
        </div>
      </div>

      {!collapsed && (

      <div className="relative min-h-0 flex-1">
        <ScrollArea className="nowheel h-full" viewportRef={viewportRef}>
          {/* Radix ScrollArea wraps children in a `display:table; min-width:100%` box that
              auto-sizes to its content's intrinsic width — with `truncate` text inside (which
              sets white-space:nowrap), that intrinsic width blows out to the untruncated text
              length instead of the viewport's real width, and everything downstream in this
              tree gets that same too-wide box to shrink against. `w-0 min-w-full` is the
              standard fix: an explicit `width:0` makes this box contribute almost nothing to the
              table's auto-sizing, while `min-width:100%` still renders it at the full available
              width, so children measure their percentages/flex-shrink against the real width. */}
          <div ref={contentRef} className="w-0 min-w-full p-2.5">
            {adding && (
              <div className="nodrag mb-2 flex items-center gap-1.5">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTab();
                    if (e.key === "Escape") {
                      setDraft("");
                      setAdding(tabs.length === 0);
                    }
                  }}
                  placeholder="https://example.com"
                  autoFocus
                  className="h-8 text-xs"
                />
                <Button size="sm" className="h-8 shrink-0 text-xs" onClick={handleAddTab}>
                  Add
                </Button>
              </div>
            )}

            {tabs.length === 0 && !adding && (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">No pages yet.</p>
            )}

            {tabs.length > 0 && view === "grid" && (
              <div className="grid grid-cols-2 gap-1.5">
                {tabs.map((tab) => (
                  <TabGridCard key={tab.id} tab={tab} onOpen={() => openTab(tab.id)} onRemove={() => handleRemoveTab(tab.id)} />
                ))}
              </div>
            )}

            {tabs.length > 0 && view === "list" && (
              <div className="flex min-w-0 flex-col gap-1">
                {tabs.map((tab) => (
                  <TabListRow key={tab.id} tab={tab} onOpen={() => openTab(tab.id)} onRemove={() => handleRemoveTab(tab.id)} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        <ScrollBottomFade visible={showScrollFade} />
      </div>
      )}

      <WebBrowserFullscreen blockId={id} tabs={tabs} activeTabId={activeTabId} onTabsChange={persistTabs} />
    </div>
  );
});

function TabFavicon({ tab }: { tab: BrowserTab }) {
  if (tab.favicon) {
    // eslint-disable-next-line @next/next/no-img-element -- external favicon, not a project asset
    return <img src={tab.favicon} alt="" className="size-6 shrink-0 rounded" />;
  }
  return <Globe className="size-6 shrink-0 text-muted-foreground" />;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function TabGridCard({ tab, onOpen, onRemove }: { tab: BrowserTab; onOpen: () => void; onRemove: () => void }) {
  return (
    <div className="group nodrag relative flex flex-col items-center gap-1 rounded-md border border-border p-2 hover:bg-accent">
      <button type="button" onClick={onOpen} className="flex w-full flex-col items-center gap-1">
        <TabFavicon tab={tab} />
        <p className="w-full truncate text-center text-xs font-medium">{tab.title || hostnameOf(tab.url)}</p>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove tab"
        className="absolute top-1 right-1 hidden rounded-full bg-background p-0.5 text-muted-foreground hover:text-foreground group-hover:block"
      >
        <X className="size-2.5" />
      </button>
    </div>
  );
}

function TabListRow({ tab, onOpen, onRemove }: { tab: BrowserTab; onOpen: () => void; onRemove: () => void }) {
  return (
    <div className="group nodrag flex min-w-0 items-center gap-2 rounded-md border border-border p-1.5 hover:bg-accent">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <TabFavicon tab={tab} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{tab.title || hostnameOf(tab.url)}</p>
          <p className="truncate text-[10.5px] text-muted-foreground">{tab.url}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove tab"
        className="hidden shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground group-hover:block"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
