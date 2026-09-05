"use client";

import { useEffect, useState } from "react";

/**
 * PRD v2 §G6 "Production hardening" — offline states (a named, previously-missing gap: this app
 * had zero network-offline detection anywhere). `navigator.onLine` for the initial read (a real
 * signal, if a blunt one — it reflects the OS/browser's link state, not "can this app's API
 * actually be reached", but that's the same tradeoff every app using this API makes and is far
 * better than nothing), kept live via the `online`/`offline` window events.
 *
 * The initial-value guard checks `typeof navigator.onLine === "boolean"`, not just `typeof
 * navigator === "undefined"` — Node.js (20+) ships its own partial `navigator` global (a real
 * `object`, with `userAgent` etc.) that does NOT include `onLine`, so on the server `navigator`
 * exists but `navigator.onLine` is `undefined`. The old guard, `typeof navigator === "undefined"
 * || navigator.onLine`, read that as falsy on the server (`false || undefined`), which SSR'd the
 * offline banner for every visitor and hydration-mismatched into it silently sticking — a real
 * bug, found live this session (the fix isn't "being more careful that `navigator` might not
 * exist," it's that `navigator` existing on the server at all, just without this one property, is
 * the actual surprise). Guarding on the specific property being present, not just its parent
 * object, is correct in both environments: `true` on Node (property doesn't exist there at all),
 * the real value in any browser (the property is always present and boolean there).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || typeof navigator.onLine !== "boolean" || navigator.onLine
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
