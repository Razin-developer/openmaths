function hashToHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

/** A generated avatar (first-letter + deterministic color), no image upload needed. */
export function UserAvatar({
  name,
  seed,
  size = 40,
}: {
  name: string | null | undefined;
  seed: string;
  size?: number;
}) {
  const letter = (name?.trim()?.[0] ?? "?").toUpperCase();
  const hue = hashToHue(seed);

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: `oklch(0.55 0.12 ${hue})`,
      }}
      aria-hidden
    >
      {letter}
    </div>
  );
}
