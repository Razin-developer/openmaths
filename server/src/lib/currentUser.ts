import { getToken } from "next-auth/jwt";
import { prisma } from "@openmaths/db";
import { env } from "../env";

/**
 * Server-side equivalent of `app`'s `getCurrentUser()` (PRD "Split into app + server" P1 —
 * interim auth verification, §4.2's "keep NextAuth in web as a verifier... Hono verifies the
 * session locally"). NextAuth in `app` stays the issuer; this decodes the SAME session cookie
 * independently using the shared `AUTH_SECRET`, via Auth.js's own `getToken()` helper (re-exported
 * from `next-auth/jwt`) rather than `auth()` itself, which needs the full Next.js request context
 * this process doesn't have.
 *
 * Default Auth.js v5 cookie name is `authjs.session-token` (`__Secure-` prefixed under HTTPS) —
 * `getToken()` derives that itself from `secureCookie`, so this only needs to get that flag right:
 * true in production (the real deploy is HTTPS), false in local dev (plain http://localhost).
 */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

const secureCookie = env.NODE_ENV === "production";

export async function getCurrentUser(request: Request) {
  const token = await getToken({ req: request, secret: env.AUTH_SECRET, secureCookie });
  const userId = typeof token?.id === "string" ? token.id : undefined;
  if (!userId) throw new UnauthorizedError();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError();

  return user;
}
