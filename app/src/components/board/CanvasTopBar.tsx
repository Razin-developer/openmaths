"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { ShareDropdown } from "@/components/board/ShareDropdown";
import { CanvasSidebar } from "@/components/board/CanvasSidebar";
import { NotificationBell } from "@/components/board/NotificationBell";
import { UsageMeter } from "@/components/board/UsageMeter";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { isTypingTarget } from "@/lib/board/keyboardGuard";
import type { CanvasRole } from "@/lib/canvasAccess";
import { api } from "@openmaths/api-client";

export function CanvasTopBar({
  canvasId,
  initialTitle,
  role,
}: {
  canvasId: string;
  initialTitle: string;
  role: CanvasRole;
}) {
  const canEdit = role === "owner" || role === "editor";
  const [title, setTitle] = useState(initialTitle);
  // The last confirmed value — Escape reverts to this rather than whatever's mid-edit, and a
  // blur-triggered save (see onBlur below) doesn't fire twice for the same Escape keypress.
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // PRD "Split into app + server" P3-continued round 3 — cut over to the base-URL client.
  function saveTitle() {
    setEditing(false);
    const trimmed = title.trim() || "Untitled canvas";
    setTitle(trimmed);
    setSavedTitle(trimmed);
    api.canvases.update(canvasId, { title: trimmed }).catch(() => {});
  }

  // Guards against the Input's onBlur firing right after Escape (React removing the focused
  // element from the DOM can trigger a native blur) and re-saving the stale, about-to-be-
  // discarded edit — without this, Escape would silently do nothing.
  const cancelingRef = useRef(false);
  function cancelEditTitle() {
    cancelingRef.current = true;
    setTitle(savedTitle);
    setEditing(false);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full border border-border bg-card py-1 pr-1 pl-1 shadow-md">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Open canvases sidebar"
            >
              <PanelLeft className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex items-center gap-1.5">
            Canvases
            <Kbd>⌘B</Kbd>
          </TooltipContent>
        </Tooltip>
        <div className="h-4 w-px bg-border" />
        <Link
          href="/dashboard"
          className="rounded-full px-2 py-1 text-[13px] font-medium tracking-tight hover:bg-accent"
        >
          openmaths
        </Link>
        {editing && canEdit ? (
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (cancelingRef.current) {
                cancelingRef.current = false;
                return;
              }
              saveTitle();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              else if (e.key === "Escape") {
                e.preventDefault();
                cancelEditTitle();
              }
            }}
            className="h-6 w-40 text-xs"
          />
        ) : canEdit ? (
          <button
            onClick={() => setEditing(true)}
            className="max-w-48 truncate rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {title}
          </button>
        ) : (
          <span className="max-w-48 truncate px-1.5 py-0.5 text-xs text-muted-foreground">{title}</span>
        )}
        {!canEdit && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            View only
          </span>
        )}
      </div>
      {/* Same pill container/style as the left cluster, mirrored to the opposite side — keeps the
          canvas title cluster uncluttered while sharing/notifications/usage/theme stay one click
          away (user ask: "move sharing notification, and credits to opposite site same way, same
          style, container, txt, size, font, weight, shadow, color"). */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full border border-border bg-card py-1 pr-1 pl-1 shadow-md">
        {/* Only whoever can generate has a budget worth watching (Viewer/Commenter can't
            generate at all — PRD "User System — Usage Metering & Notifications" §4.2). */}
        {canEdit && <UsageMeter />}
        <NotificationBell canvasId={canvasId} />
        {/* Owner-only (PRD §7 "Owner-only: sharing management") — editors can use a canvas, not re-share it. */}
        {role === "owner" && <ShareDropdown canvasId={canvasId} />}
        <div className="h-4 w-px bg-border" />
        <ThemeToggle />
      </div>
      <CanvasSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} currentCanvasId={canvasId} />
    </>
  );
}
