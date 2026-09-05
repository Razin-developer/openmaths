import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";

/**
 * PRD "Split into app + server" P2 — `server` is the session ISSUER (see
 * `server/src/lib/auth/session.ts`'s own doc comment for the compatibility contract: a
 * Hono-issued token is indistinguishable from one NextAuth minted itself, as long as it decodes
 * with the same secret/salt and carries the same `{id, tokenVersion, validatedAt}` shape). NextAuth
 * here exists ONLY to VERIFY that cookie — for `proxy.ts`'s Middleware gate (`auth()`, wrapping
 * every page) and `app/page.tsx`'s logged-in-visitor redirect. No provider ever runs a sign-in
 * flow through this file.
 *
 * The Credentials provider + its `authorize()` callback (rate limiting, bcrypt compare, TOTP/
 * backup-code step-up) that used to mint sessions here directly was removed in a later cleanup
 * pass, once it became permanently unreachable: P4 deleted
 * `app/src/app/api/auth/[...nextauth]/route.ts` (the only HTTP route that could ever invoke
 * NextAuth's own sign-in flow), and nothing in this app calls `next-auth/react`'s `signIn()`
 * either (`login-form.tsx`/`signup-form.tsx` call `server`'s `/auth/login`/`/auth/signup`
 * directly instead, via `packages/api-client`) — confirmed via a full grep of the codebase before
 * removing it, not assumed. `providers: []` reflects that honestly rather than keeping a
 * decoy Credentials config nothing can reach.
 */
export const { auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    // Auth bug fix (dashboard/login stuck loop with a stale token): a JWT session's signature
    // staying valid says nothing about whether the account it names still exists — proxy.ts's
    // middleware only ever reads this decoded token (no DB call, by design, per Next's own
    // middleware guidance), so a user deleted or a dev DB reset out from under a still-signed
    // cookie used to authenticate FOREVER as far as the middleware was concerned. Re-verifying the
    // underlying user against the DB here (throttled, not on every single call) makes the token
    // itself go invalid the moment this runs — which is the same lightweight path proxy.ts's
    // middleware already calls into via auth() — so `request.auth` becomes falsy on its own and
    // the normal "not authed -> /login" rule fires cleanly instead of looping.
    //
    // (The `{token, user}` sign-in branch this callback used to have — populating a fresh token
    // from `authorize()`'s return value — is gone along with `authorize()` itself: `user` is
    // never populated anymore, since nothing signs in through this file.)
    async jwt({ token }) {
      if (!token.id) return null;
      const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;
      const lastValidated = typeof token.validatedAt === "number" ? token.validatedAt : 0;
      if (Date.now() - lastValidated < REVALIDATE_INTERVAL_MS) return token;
      // PRD F8 — the same throttled DB touch that heals a deleted-user's stale session also
      // carries session revocation: a mismatched tokenVersion means "sign out everywhere" (or a
      // password change) fired since this token was minted, so it's rejected the same way a
      // deleted user is — see lib/auth/sessions.ts for the full rationale/trade-off.
      const current = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { tokenVersion: true },
      });
      if (!current) return null;
      if (current.tokenVersion !== token.tokenVersion) return null;
      token.validatedAt = Date.now();
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
