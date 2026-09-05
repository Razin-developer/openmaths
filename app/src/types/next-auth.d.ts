import type { DefaultSession, User as DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
  interface User extends DefaultUser {
    /** Stamped onto the JWT at sign-in so the jwt() callback can later detect a "sign out
     * everywhere" / password-change revocation — see lib/auth/sessions.ts. */
    tokenVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tokenVersion?: number;
    /** Epoch ms of the last time auth.ts's jwt() callback confirmed this token's user still
     * exists in the DB (and, per F8, that its tokenVersion still matches) — see auth.ts for why
     * this throttled re-check exists. */
    validatedAt?: number;
  }
}
