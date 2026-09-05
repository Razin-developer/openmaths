import { Star } from "lucide-react";

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

export function TestimonialCard({ quote, name, role }: Testimonial) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-6">
      <div className="flex gap-0.5 text-warning" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="size-4" fill="currentColor" strokeWidth={0} />
        ))}
      </div>
      <p className="text-body text-foreground">&ldquo;{quote}&rdquo;</p>
      <div className="text-body-sm text-muted-foreground">
        <span className="font-medium text-foreground">{name}</span> — {role}
      </div>
    </div>
  );
}
