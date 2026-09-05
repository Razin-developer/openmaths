/**
 * PRD "User System — Usage Metering & Notifications" §4.3: guard against double-recording a
 * billed generation on stream retry/replay. This app's streaming response is a single long-lived
 * NDJSON HTTP response with no reconnect/resume protocol (see messages/route.ts) — a disconnect
 * just orphans the server-side generation, it doesn't get replayed. The real risk is a client
 * that retries the *same* logical send with a fresh HTTP request (e.g. a future auto-retry-on-
 * network-error). A client-supplied `requestId`, stable across such a retry, is checked here
 * before the ActivityEvent write; the second attempt still returns an answer to the user, it just
 * doesn't get billed twice.
 *
 * In-process Map, same trade-off already accepted by rateLimit.ts and the narrate route's
 * in-flight synthesis lock: resets on server restart, not shared across instances — a
 * cost-control backstop, not a distributed-systems guarantee. Fine at this app's scale.
 */
const seen = new Map<string, number>();
const TTL_MS = 10 * 60 * 1000;

function evictStale(now: number) {
  for (const [key, ts] of seen) {
    if (now - ts > TTL_MS) seen.delete(key);
  }
}

/** Returns true if this requestId was already marked processed (caller should skip billing this
 * time); otherwise marks it processed and returns false. No-op (always returns false) when
 * `requestId` is falsy — dedupe is opt-in per request. */
export function wasAlreadyProcessed(requestId: string | null | undefined): boolean {
  if (!requestId) return false;
  const now = Date.now();
  evictStale(now);
  if (seen.has(requestId)) return true;
  seen.set(requestId, now);
  return false;
}
