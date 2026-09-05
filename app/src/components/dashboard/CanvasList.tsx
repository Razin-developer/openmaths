"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Grid3x3, List, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@openmaths/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CanvasThumbnail } from "@/components/dashboard/CanvasThumbnail";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";

interface CanvasSummary {
  id: string;
  title: string;
  updatedAt: string;
  isOwner: boolean;
  role: "owner" | "editor" | "commenter" | "viewer" | null;
  sharedBy: string | null;
  unreadCount: number;
  blocks: { id: string; kind: string; positionX: number; positionY: number }[];
}

type SortKey = "recent" | "name";
type ViewMode = "grid" | "list";

export function CanvasList() {
  const router = useRouter();
  const [canvases, setCanvases] = useState<CanvasSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("grid");

  // PRD "Split into app + server" P3-continued round 3 — cut over to the base-URL client; all of
  // canvases CRUD is now on `server`.
  useEffect(() => {
    api.canvases
      .list()
      .then((data) => setCanvases((data.canvases as CanvasSummary[]) ?? []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setCanvases([]);
      });
  }, [router]);

  async function handleCreate() {
    setCreating(true);
    try {
      const { canvas } = await api.canvases.create();
      router.push(`/canvas/${(canvas as { id: string }).id}`);
    } catch {
      toast.error("Couldn't create a canvas");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setCanvases((prev) => prev?.filter((c) => c.id !== id) ?? null);
    try {
      await api.canvases.remove(id);
    } catch {
      toast.error("Couldn't delete that canvas");
    }
  }

  const filtered = useMemo(() => {
    const list = (canvases ?? []).filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()));
    return [...list].sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [canvases, query, sort]);

  const owned = useMemo(() => filtered.filter((c) => c.isOwner), [filtered]);
  const shared = useMemo(() => filtered.filter((c) => !c.isOwner), [filtered]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search canvases…"
            className="h-9 pr-14 pl-8 text-xs"
          />
          <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">⌘K</Kbd>
        </div>
        <Button className="h-9 gap-1.5 text-xs" onClick={handleCreate} disabled={creating}>
          <Plus className="size-3.5" />
          New canvas
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          {filtered.length.toString().padStart(2, "0")} canvases · sorted by {sort === "name" ? "name" : "recent"}
        </span>
        <div className="flex items-center gap-1.5">
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger size="sm" className="h-7 gap-1 text-xs">
              <ArrowUpDown className="size-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="recent" className="text-xs">
                Recent
              </SelectItem>
              <SelectItem value="name" className="text-xs">
                Name
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-md border border-border p-0.5">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setView("grid")}
              aria-label="Grid view"
            >
              <Grid3x3 className="size-3" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <List className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {canvases === null && <p className="text-xs text-muted-foreground">Loading…</p>}
      {canvases !== null && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground">No canvases found.</p>
      )}

      {owned.length > 0 && (
        <CanvasGroup title="My canvases" canvases={owned} view={view} onDelete={handleDelete} />
      )}
      {shared.length > 0 && (
        <CanvasGroup title="Shared with me" canvases={shared} view={view} onDelete={handleDelete} />
      )}
    </div>
  );
}

function CanvasGroup({
  title,
  canvases,
  view,
  onDelete,
}: {
  title: string;
  canvases: CanvasSummary[];
  view: ViewMode;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-[11px] font-medium text-muted-foreground">{title}</h2>
      {view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {canvases.map((c) => (
            <CanvasCard key={c.id} canvas={c} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {canvases.map((c) => (
            <CanvasRow key={c.id} canvas={c} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { editor: "Editor", commenter: "Commenter", viewer: "Viewer" };

function SharedBadge({ canvas: c }: { canvas: CanvasSummary }) {
  if (c.isOwner || !c.role) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {c.unreadCount > 0 && (
        // PRD "User System — Usage Metering & Notifications" §5.2 — the dashboard's "Shared with
        // me" cards also surface how many unread notifications belong to that canvas.
        <span
          className="rounded-full bg-primary px-1.5 py-0.5 text-[9.5px] font-medium text-primary-foreground"
          title={`${c.unreadCount} unread notification${c.unreadCount === 1 ? "" : "s"}`}
        >
          {c.unreadCount > 9 ? "9+" : c.unreadCount}
        </span>
      )}
      <span
        className="rounded-full bg-muted px-1.5 py-0.5 text-[9.5px] font-medium text-muted-foreground"
        title={c.sharedBy ? `Shared by ${c.sharedBy}` : undefined}
      >
        {ROLE_LABEL[c.role] ?? c.role}
      </span>
    </span>
  );
}

function CanvasCard({ canvas: c, onDelete }: { canvas: CanvasSummary; onDelete: (id: string) => void }) {
  return (
    <div className="group/card relative rounded-lg border border-border">
      <Link href={`/canvas/${c.id}`} className="block">
        <div className="flex h-24 items-center justify-center rounded-t-lg border-b border-border bg-[radial-gradient(var(--canvas-dot)_1px,transparent_1px)] bg-[size:12px_12px] p-1.5">
          <CanvasThumbnail blocks={c.blocks} />
        </div>
        <div className="flex items-center gap-1 p-2">
          {!c.isOwner && <Users className="size-3 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.title}</span>
          <SharedBadge canvas={c} />
        </div>
        <div className="flex items-center justify-between px-2 pb-2 text-[10px] text-muted-foreground">
          <span>{timeAgo(new Date(c.updatedAt))}</span>
          <span>{c.blocks.length.toString().padStart(2, "0")} nodes</span>
        </div>
      </Link>
      {c.isOwner && <CanvasDeleteButton canvas={c} onDelete={onDelete} className="absolute top-1.5 right-1.5" />}
    </div>
  );
}

function CanvasRow({ canvas: c, onDelete }: { canvas: CanvasSummary; onDelete: (id: string) => void }) {
  return (
    <div className="group/row flex items-center gap-3 px-3 py-2 hover:bg-accent">
      <Link href={`/canvas/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-9 w-14 shrink-0 overflow-hidden rounded border border-border bg-[radial-gradient(var(--canvas-dot)_1px,transparent_1px)] bg-[size:8px_8px]">
          <CanvasThumbnail blocks={c.blocks} />
        </div>
        {!c.isOwner && <Users className="size-3 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.title}</span>
        <SharedBadge canvas={c} />
        <span className="shrink-0 text-[10.5px] text-muted-foreground">
          {c.blocks.length.toString().padStart(2, "0")} nodes
        </span>
        <span className="shrink-0 text-[10.5px] text-muted-foreground">{timeAgo(new Date(c.updatedAt))}</span>
      </Link>
      {c.isOwner && <CanvasDeleteButton canvas={c} onDelete={onDelete} className="opacity-0 group-hover/row:opacity-100" />}
    </div>
  );
}

function CanvasDeleteButton({
  canvas: c,
  onDelete,
  className,
}: {
  canvas: CanvasSummary;
  onDelete: (id: string) => void;
  className?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn("bg-card", className)}
          aria-label={`Delete ${c.title}`}
        >
          <Trash2 className="size-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{c.title}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the canvas and everything on it. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete(c.id)}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
