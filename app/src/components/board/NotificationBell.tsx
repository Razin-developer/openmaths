"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Circle, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { api } from "@openmaths/api-client";

interface NotificationData {
  canvasTitle?: string;
  role?: string;
  actorName?: string | null;
  percentUsed?: number;
  hardStop?: boolean;
  blockTitle?: string | null;
}

type NotificationType =
  | "CANVAS_SHARED"
  | "ROLE_CHANGED"
  | "CANVAS_UNSHARED"
  | "COMMENT_ADDED"
  | "USAGE_CAP_WARNING"
  | "GENERATION_FINISHED";

interface Notification {
  id: string;
  type: NotificationType;
  canvasId: string | null;
  data: NotificationData | null;
  readAt: string | null;
  createdAt: string;
}

const POLL_INTERVAL_MS = 20_000;

function describe(n: Notification): string {
  const who = n.data?.actorName ?? "Someone";
  const title = n.data?.canvasTitle ?? "a canvas";
  const role = n.data?.role;
  switch (n.type) {
    case "CANVAS_SHARED":
      return `${who} shared "${title}" with you${role ? ` — ${role}` : ""}`;
    case "ROLE_CHANGED":
      return `${who} changed your access to "${title}"${role ? ` — now ${role}` : ""}`;
    case "CANVAS_UNSHARED":
      return `${who} removed your access to "${title}"`;
    case "COMMENT_ADDED":
      return `${who} commented on "${title}"`;
    case "USAGE_CAP_WARNING":
      return n.data?.hardStop
        ? "You've used up your monthly AI budget"
        : `You've used ${n.data?.percentUsed ?? 80}% of your monthly AI budget`;
    case "GENERATION_FINISHED":
      return `"${n.data?.blockTitle ?? "Your question"}" in "${title}" is ready`;
    default:
      return "New notification";
  }
}

/**
 * The bell + unread badge (PRD "Sharing, Collaboration & Access Roles" §6; scoping/hover-toggle
 * per "User System — Usage Metering & Notifications" §5). Two modes: pass `canvasId` for the
 * canvas-page bell (only that canvas's notifications, per-canvas unread badge); omit it for the
 * global/home bell (everything, grouped by canvas). Polls on an interval rather than SSE/
 * websocket, per the PRD's own P1 scope note.
 */
export function NotificationBell({ canvasId }: { canvasId?: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  // PRD "Split into app + server" P3 — cut over to the base-URL client; /notifications is one of
  // the routes P1 already ported to `server`.
  async function load() {
    try {
      const data = await api.notifications.list(canvasId);
      setNotifications((data.notifications as Notification[]) ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Same silent-fail-and-keep-stale-state behavior as before (a `!res.ok` early return) —
      // a poll failing shouldn't clear an already-populated bell.
    }
  }

  useEffect(() => {
    // Initial fetch + poll — `load` sets state only after its own `await fetch(...)` resolves
    // (an external-system round trip, not a value derivable from props/state), which is exactly
    // the case this lint rule means to allow; it just can't see through the async boundary here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  /** Optimistic — flips `readAt` locally first, reconciles by refetching on failure so a flaky
   * request never leaves the badge permanently wrong (PRD §5.3). */
  async function setRead(id: string, read: boolean) {
    const wasUnread = notifications.find((n) => n.id === id)?.readAt == null;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: read ? (n.readAt ?? new Date().toISOString()) : null } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev + (read ? (wasUnread ? -1 : 0) : wasUnread ? 0 : 1)));
    const ok = await api.notifications.markRead({ id, read }).then(
      () => true,
      () => false
    );
    if (!ok) load();
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    const ok = await api.notifications.markRead().then(
      () => true,
      () => false
    );
    if (!ok) load();
  }

  // Grouped by canvas only for the global/home bell — the per-canvas bell is already scoped to
  // one canvas, grouping there would just be a redundant single header (PRD §5.2).
  const groups = useMemo(() => {
    if (canvasId) return [{ key: "self", title: null as string | null, items: notifications }];
    const order: string[] = [];
    const map = new Map<string, Notification[]>();
    for (const n of notifications) {
      const key = n.canvasId ?? "__none__";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(n);
    }
    return order.map((key) => ({
      key,
      title: key === "__none__" ? null : (map.get(key)![0].data?.canvasTitle ?? "a canvas"),
      items: map.get(key)!,
    }));
  }, [notifications, canvasId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative rounded-full" aria-label="Notifications">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[9px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium">
          Notifications
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs font-normal text-muted-foreground hover:text-foreground">
              Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">Nothing yet.</p>
        ) : (
          <ScrollArea className="max-h-80">
            {groups.map((group) => (
              <div key={group.key}>
                {group.title !== null && (
                  <div className="bg-muted/50 px-3 py-1 text-[10px] font-medium text-muted-foreground">
                    {group.title}
                  </div>
                )}
                <ul>
                  {group.items.map((n) => {
                    const unread = !n.readAt;
                    return (
                      <li key={n.id} className="group/notif flex items-start border-b border-border last:border-0">
                        {n.canvasId ? (
                          <Link
                            href={`/canvas/${n.canvasId}`}
                            onClick={() => unread && setRead(n.id, true)}
                            className="block min-w-0 flex-1 px-3 py-2 text-xs leading-snug hover:bg-accent"
                          >
                            <span className={cn("flex items-center gap-1.5", unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                              {unread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                              {describe(n)}
                            </span>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(new Date(n.createdAt))}</div>
                          </Link>
                        ) : (
                          <div className="min-w-0 flex-1 px-3 py-2 text-xs leading-snug">
                            <span className={cn("flex items-center gap-1.5", unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                              {unread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                              {describe(n)}
                            </span>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(new Date(n.createdAt))}</div>
                          </div>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setRead(n.id, unread ? true : false)}
                              aria-label={unread ? "Mark read" : "Mark unread"}
                              className="mr-1 mt-2 shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover/notif:opacity-100"
                            >
                              {unread ? <Circle className="size-3" /> : <CircleDot className="size-3" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">{unread ? "Mark read" : "Mark unread"}</TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
