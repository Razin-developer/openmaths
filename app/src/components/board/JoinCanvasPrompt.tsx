"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@openmaths/api-client";

/** Explicit "Join canvas" confirmation (PRD "Auth & Security Audit" F7) — visiting a share link
 * used to grant access as a side effect of the page just loading (a GET); this makes redemption a
 * deliberate click, so a prefetch/CSRF/bot hit on the URL doesn't silently add anyone. */
export function JoinCanvasPrompt({
  canvasId,
  token,
  canvasTitle,
  ownerName,
  role,
}: {
  canvasId: string;
  token: string;
  canvasTitle: string;
  ownerName: string | null;
  role: string;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PRD "Split into app + server" P3-continued round 4 — cut over to the base-URL client.
  async function handleJoin() {
    setJoining(true);
    setError(null);
    try {
      await api.sharing.join(canvasId, token);
      router.replace(`/canvas/${canvasId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't join this canvas");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-5 text-center shadow-sm">
        <p className="text-sm font-medium">
          {ownerName ? `${ownerName} invited you to` : "You've been invited to"}
        </p>
        <p className="truncate text-base font-semibold">{canvasTitle}</p>
        <p className="text-xs text-muted-foreground">You&apos;ll have {role} access.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button className="w-full" onClick={handleJoin} disabled={joining}>
          {joining ? "Joining…" : "Join canvas"}
        </Button>
      </div>
    </div>
  );
}
