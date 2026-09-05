import { encode, decode } from "next-auth/jwt";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import { env } from "../../env";

/**
 * PRD "Split into app + server" P2 — Hono becomes the session issuer. NextAuth's own JWT session
 * strategy (`app/src/auth.ts`) is left completely untouched: its `jwt()` callback treats a
 * Hono-issued token exactly like one it minted itself, as long as the token decodes with the same
 * secret/salt and carries the same shape it already expects — `{ id, tokenVersion, validatedAt }`,
 * precisely what `auth.ts`'s own `jwt()` callback sets on a fresh sign-in. That shape match is
 * the entire compatibility contract; nothing else about NextAuth needed to change.
 *
 * Cookie name/salt: Auth.js v5 defaults to `authjs.session-token` (`__Secure-` prefixed under
 * HTTPS) — `getToken()` (used both here indirectly and in `lib/currentUser.ts`) derives this from
 * `secureCookie`, and `encode()`'s `salt` must be the same cookie name for `decode()` to find the
 * matching derived key (see @auth/core/jwt's `getDerivedEncryptionKey` — salt is a KDF input, not
 * a cosmetic label).
 */
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days, matching @auth/core/jwt's own default
const secureCookie = env.NODE_ENV === "production";
const cookieName = secureCookie ? "__Secure-authjs.session-token" : "authjs.session-token";

export interface SessionTokenPayload {
  id: string;
  tokenVersion: number;
  validatedAt: number;
}

export async function issueSession(c: Context, payload: SessionTokenPayload): Promise<void> {
  const token = await encode({
    token: payload,
    secret: env.AUTH_SECRET,
    salt: cookieName,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  setCookie(c, cookieName, token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    // Empty in local dev (host-only cookie, correct for plain localhost — see server/.env's own
    // comment); set to the real parent domain (e.g. ".openmaths.com") in production so `app`'s
    // origin can read a cookie `server`'s origin set.
    domain: env.COOKIE_DOMAIN || undefined,
  });
}

export function clearSession(c: Context): void {
  deleteCookie(c, cookieName, {
    path: "/",
    domain: env.COOKIE_DOMAIN || undefined,
  });
}

/** Re-exported so callers that need to read the token they just verified (rather than just
 * knowing a user is authenticated) don't need a second import of `next-auth/jwt`. */
export { decode };
