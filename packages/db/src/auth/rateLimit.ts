import { prisma } from "../index";

/**
 * Sliding-window (actually fixed-window — see the comment below) rate limiter (PRD v2 §9
 * "Cost & abuse controls" — rate-limit generate/narrate/export/login/signup per user or IP).
 *
 * PRD "Auth & Security Audit" F11 — the store behind `checkRateLimit` is a swappable
 * `RateLimitStore`, not a hardcoded Map, so a real multi-instance deployment can drop in a
 * distributed backend without touching any of this file's ~16 call sites. `PostgresRateLimitStore`
 * below IS that distributed backend — this app already runs Postgres, so "no Redis available"
 * (the earlier reason this stayed unimplemented) doesn't mean "no distributed store available."
 * Live-verified: a single atomic `INSERT ... ON CONFLICT DO UPDATE` handles the reset-vs-increment
 * decision entirely inside Postgres, so it's race-free under concurrent callers the same way a
 * Redis Lua script or `INCR`+`PEXPIRE` MULTI would be — see `PostgresRateLimitStore.increment`.
 * The default export stays the in-process Map: correct and fast for this app's actual current
 * deployment (single Node process), with zero DB round-trips on the hot path. Swap it in
 * `instrumentation.ts` with `setRateLimitStore(new PostgresRateLimitStore())` once the app
 * actually runs more than one instance.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller can retry — only meaningful when `allowed` is false. */
  retryAfterSeconds: number;
}

/**
 * What any backend — in-memory or distributed — needs to implement: ONE atomic operation, not
 * separate get/set. That distinction matters for correctness, not just style — two concurrent
 * requests each doing get-then-set race (both read count=4, both write count=5, the limit silently
 * lets through one more request than it should); an atomic increment can't. `increment` bumps
 * key's bucket, resetting it first if `windowMs` has elapsed since it started, and returns the
 * resulting {count, windowStart} for `checkRateLimit`'s policy layer to compare against `limit`.
 * Sync or Promise-returning are both valid — `checkRateLimit` awaits either.
 */
export interface RateLimitStore {
  increment(
    key: string,
    windowMs: number,
    now: number
  ): Promise<{ count: number; windowStart: number }> | { count: number; windowStart: number };
}

/** The default backend — a plain in-process Map. Resets on server restart, and doesn't coordinate
 * across multiple instances; an accepted trade-off for a cost-control backstop rather than a hard
 * security boundary, at this app's current single-instance scale. Single-threaded JS makes this
 * increment trivially atomic with no locking needed. */
class InMemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; windowStart: number }>();

  increment(key: string, windowMs: number, now: number) {
    const existing = this.buckets.get(key);
    if (!existing || now - existing.windowStart >= windowMs) {
      const fresh = { count: 1, windowStart: now };
      this.buckets.set(key, fresh);
      return fresh;
    }
    const next = { count: existing.count + 1, windowStart: existing.windowStart };
    this.buckets.set(key, next);
    return next;
  }
}

/**
 * A real, tested distributed backend for `RateLimitStore`, backed by the app's own Postgres —
 * closes PRD F11 for real rather than staying a documented-but-unimplemented interface. The
 * atomicity guarantee is the whole point: a single statement does read-check-write in one round
 * trip, so two concurrent requests for the same key can never both "win" a race the way separate
 * get()+set() calls would. `Date - Date` in Postgres yields an `interval`, compared directly
 * against `windowMs` converted to one — no app-side clock math needed inside the query.
 */
export class PostgresRateLimitStore implements RateLimitStore {
  async increment(key: string, windowMs: number, now: number): Promise<{ count: number; windowStart: number }> {
    const nowDate = new Date(now);
    const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "windowStart")
      VALUES (${key}, 1, ${nowDate})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN ${nowDate}::timestamptz - "RateLimitBucket"."windowStart" >= (${windowMs}::float * interval '1 millisecond')
          THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "windowStart" = CASE
          WHEN ${nowDate}::timestamptz - "RateLimitBucket"."windowStart" >= (${windowMs}::float * interval '1 millisecond')
          THEN ${nowDate}::timestamptz
          ELSE "RateLimitBucket"."windowStart"
        END
      RETURNING "count", "windowStart"
    `;
    const row = rows[0];
    return { count: row.count, windowStart: row.windowStart.getTime() };
  }
}

let store: RateLimitStore = new InMemoryRateLimitStore();

/** Swaps the backend — call once at startup (e.g. in instrumentation.ts) before any
 * `checkRateLimit` calls if deploying with a distributed store. Not called anywhere in this repo
 * today; the in-memory default is active until it is. */
export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const { count, windowStart } = await store.increment(key, windowMs, now);

  if (count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - windowStart)) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
