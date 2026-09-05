"use client";

import * as React from "react";
import { useTheme } from "./theme-provider";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";

const emptySubscribe = () => () => {};

function useHasMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-full"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-3.5" />
      ) : (
        <Moon className="size-3.5" />
      )}
    </Button>
  );
}
