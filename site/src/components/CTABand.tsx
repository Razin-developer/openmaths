import { Button } from "./Button";

export function CTABand({ title, href = "http://localhost:3000" }: { title: string; href?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border px-8 py-16 text-center">
      <div className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-glow)" }} aria-hidden />
      <div className="relative flex flex-col items-center gap-6">
        <h2 className="text-h2 font-semibold text-balance">{title}</h2>
        <Button href={href} variant="primary">
          Start free
        </Button>
      </div>
    </div>
  );
}
