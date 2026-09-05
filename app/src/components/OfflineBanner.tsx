"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

/**
 * PRD v2 §G6 "Production hardening" — offline states. A persistent (not a toast — this is
 * ongoing state, not a one-off event) banner across the whole app the moment the browser reports
 * no connection, so a student mid-question isn't left guessing why "Send" just silently stalled.
 * Reappearing generation/save affordances re-enable themselves automatically once `useOnlineStatus`
 * flips back — see PromptInput.tsx's `disabled` gate, the one other place this hook is used.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    // Fixed overlay, not part of normal flow — canvas routes size their own chrome to a bare
    // `h-screen` with no header to make room for (AppShell.tsx), so a normal-flow banner here
    // would push that content past the viewport instead of sharing it.
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-1.5 border-b border-border bg-destructive/10 px-3 py-1 text-xs text-destructive"
    >
      <WifiOff className="size-3.5" />
      You&apos;re offline — reconnect to ask questions or save changes.
    </div>
  );
}
