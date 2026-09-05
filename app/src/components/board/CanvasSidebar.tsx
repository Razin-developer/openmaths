"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@openmaths/api-client";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CanvasThumbnail } from "@/components/dashboard/CanvasThumbnail";

interface CanvasSummary {
  id: string;
  title: string;
  updatedAt: string;
  isOwner: boolean;
  blocks: { id: string; kind: string; positionX: number; positionY: number }[];
}

export function CanvasSidebar({
  open,
  onOpenChange,
  currentCanvasId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCanvasId: string;
}) {
  const router = useRouter();
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  // PRD "Split into app + server" P3 — cut over the list (GET) to the base-URL client; creation
  // (POST, below) stays on app's own /api/canvases until that route is ported.
  useEffect(() => {
    if (!open) return;
    api.canvases
      .list()
      .then((data) => setCanvases((data.canvases as CanvasSummary[]) ?? []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.push("/login");
      });
  }, [open, router]);

  // PRD "Split into app + server" P3-continued round 3 — cut over to the base-URL client.
  async function handleCreate() {
    setCreating(true);
    try {
      const { canvas } = await api.canvases.create();
      router.push(`/canvas/${(canvas as { id: string }).id}`);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't create a canvas");
    } finally {
      setCreating(false);
    }
  }

  const filtered = canvases.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 gap-0 p-0 sm:max-w-72">
        <SheetHeader className="border-b border-border py-3 pr-9 pl-3">
          <SheetTitle className="text-sm">Your canvases</SheetTitle>
          <div className="relative mt-1">
            <Search className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search canvases…"
              className="h-7 pl-6 text-xs"
            />
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100%-6.5rem)]">
          <div className="flex flex-col gap-1 p-2">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/canvas/${c.id}`}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md p-1.5 text-xs hover:bg-accent",
                  c.id === currentCanvasId && "bg-accent font-medium"
                )}
              >
                <div className="h-9 w-14 shrink-0 overflow-hidden rounded border border-border bg-muted/40">
                  <CanvasThumbnail blocks={c.blocks} />
                </div>
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                {!c.isOwner && <Users className="size-3 shrink-0 text-muted-foreground" />}
              </Link>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">No canvases found.</p>
            )}
          </div>
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleCreate} disabled={creating}>
            <Plus className="size-3.5" />
            New canvas
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
