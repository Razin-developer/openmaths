"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { DEFAULT_MODEL_ID } from "@/lib/ai/client";
import { api } from "@openmaths/api-client";

// PRD "Split into app + server" P3 — cut over to the base-URL client; /models is one of the
// routes P1 already ported to `server`.
async function fetchModels(): Promise<{ id: string }[]> {
  try {
    const { models } = await api.models.list();
    return models;
  } catch {
    return [];
  }
}

/** "deepseek/deepseek-v4-flash-0731" -> "deepseek-v4-flash-0731" — the picker shows just the model name, not the provider prefix. */
function modelName(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1];
}

export function ModelPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: models, isLoading } = useQuery({ queryKey: ["models"], queryFn: fetchModels, staleTime: 5 * 60 * 1000 });
  const current = value ?? DEFAULT_MODEL_ID;
  const options = models ?? [{ id: DEFAULT_MODEL_ID }];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="nodrag h-6 gap-1 px-1.5 text-xs text-muted-foreground">
          {modelName(current)}
          <ChevronDown className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="nodrag w-56 p-0">
        <Command>
          <CommandInput placeholder="Search models…" className="text-xs" />
          <CommandList className="max-h-56">
            {isLoading ? (
              <div className="flex items-center justify-center gap-1.5 py-4 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Loading models…
              </div>
            ) : (
              <CommandEmpty className="py-4 text-xs">No models found.</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((model) => (
                <CommandItem
                  key={model.id}
                  value={model.id}
                  className="text-xs"
                  onSelect={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                >
                  {modelName(model.id)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
