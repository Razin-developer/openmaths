"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@openmaths/components/theme-provider";

const emptySubscribe = () => () => {};

/** Avoids a hydration mismatch: the resolved theme is only known client-side (see
 * theme-provider's own SSR snapshot, which always returns "light"). */
function useHasMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * Site-native, not `@openmaths/components/theme-toggle` — that component renders
 * `packages/components`'s own shadcn `<Button>`, which needs app's `theme.css` CSS variables
 * (`--primary`, `--ring`, etc.) that this deliberately separate design system (PRD §3) doesn't
 * define. Only the underlying theme-provider logic (palette-agnostic: it just toggles a `.dark`
 * class) is shared.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex size-9 items-center justify-center rounded-pill text-foreground transition-colors duration-base hover:bg-muted"
    >
      {mounted && resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
