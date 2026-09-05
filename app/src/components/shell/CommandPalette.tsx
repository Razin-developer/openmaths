"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Moon, Plus, Settings, Sun } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useTheme } from "@/components/theme-provider";
import { api } from "@openmaths/api-client";

interface CanvasSummary {
  id: string;
  title: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [canvases, setCanvases] = useState<CanvasSummary[] | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // PRD "Split into app + server" P3 — cut over the list (GET) to the base-URL client; creation
  // (POST, below) stays on app's own /api/canvases until that route is ported.
  useEffect(() => {
    if (!open || canvases !== null) return;
    api.canvases
      .list()
      .then((data) => setCanvases(((data.canvases as CanvasSummary[]) ?? []).map((c) => ({ id: c.id, title: c.title }))))
      .catch(() => setCanvases([]));
  }, [open, canvases]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  // PRD "Split into app + server" P3-continued round 3 — cut over to the base-URL client.
  async function handleNewCanvas() {
    setOpen(false);
    const { canvas } = await api.canvases.create().catch(() => ({ canvas: null }));
    if (!canvas) return;
    router.push(`/canvas/${(canvas as { id: string }).id}`);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search canvases or run a command…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={handleNewCanvas}>
            <Plus /> New canvas
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard /> Go to dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings /> Go to settings
          </CommandItem>
          <CommandItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            Toggle theme
          </CommandItem>
        </CommandGroup>
        {canvases && canvases.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Canvases">
              {canvases.map((c) => (
                <CommandItem key={c.id} value={c.title} onSelect={() => go(`/canvas/${c.id}`)}>
                  {c.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
      <div className="flex items-center justify-end gap-1 border-t border-border px-3 py-1.5 text-[10.5px] text-muted-foreground">
        <span>Open anytime with</span>
        <CommandShortcut>⌘K</CommandShortcut>
      </div>
    </CommandDialog>
  );
}
