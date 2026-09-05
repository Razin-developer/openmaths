"use client";

import { useTheme } from "@/components/theme-provider";
import { Toaster } from "sonner";

export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!bg-popover !text-popover-foreground !border-border !shadow-md",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
