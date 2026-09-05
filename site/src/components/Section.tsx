import { cn } from "@openmaths/components/lib/utils";

interface SectionProps extends React.ComponentProps<"section"> {
  /** PRD §3: content ~1200, wide (bento) ~1320. Prose gets its own 68ch cap where used directly. */
  width?: "content" | "wide" | "full";
  /** Landing-rework PRD §3.5: alternate sections onto `--surface-shell` so the page reads as
   * layered surfaces rather than one flat sheet — default `base` matches the prior behavior. */
  surface?: "base" | "shell";
}

const WIDTH_CLASS: Record<NonNullable<SectionProps["width"]>, string> = {
  content: "max-w-[1200px]",
  wide: "max-w-[1320px]",
  full: "max-w-none",
};

/** Enforces the PRD's section vertical rhythm (96-160px) and max content width — every marketing
 * page section should be one of these, not a bare `<section>`. */
export function Section({ width = "content", surface = "base", className, children, ...props }: SectionProps) {
  return (
    <section className={cn("py-24 md:py-32 lg:py-40", surface === "shell" && "bg-surface-shell", className)} {...props}>
      <div className={cn("mx-auto px-6", WIDTH_CLASS[width])}>{children}</div>
    </section>
  );
}
