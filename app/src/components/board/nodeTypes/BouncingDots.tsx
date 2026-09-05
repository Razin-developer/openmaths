import { cn } from "@/lib/utils";

export function BouncingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-0.5", className)} aria-hidden>
      <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s] [animation-duration:0.9s]" />
      <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s] [animation-duration:0.9s]" />
      <span className="size-1 animate-bounce rounded-full bg-current [animation-duration:0.9s]" />
    </span>
  );
}
