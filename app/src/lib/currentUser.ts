import { redirect } from "next/navigation";
import { api, ApiError } from "@openmaths/api-client";
import { serverApiOptions } from "@/lib/serverApi";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** The shape `server`'s `GET /user` returns — a safe projection of the full Prisma `User` row,
 * plus `hasPassword`/`mfaEnabled` derived booleans (never the raw `passwordHash`/`totpSecret`). */
export interface CurrentUser {
  id: string;
  displayName: string | null;
  email: string | null;
  defaultModelId: string | null;
  imageModelId: string | null;
  fileModelId: string | null;
  drawingModelId: string | null;
  fontSize: string | null;
  fontFamily: string | null;
  personalization: unknown;
  createdAt: string;
  hasPassword: boolean;
  mfaEnabled: boolean;
}

/**
 * Resolves the signed-in user's row via `server`'s own `GET /user` (PRD "Split into app +
 * server" P4 — `app` no longer touches Prisma to resolve this; `server`'s `requireAuth`
 * middleware does the same session-decode + "does this user still exist" check `app`'s original
 * direct-Prisma version did). `proxy.ts`'s Middleware already keeps unauthenticated traffic off
 * every page/route that would call this, so a 401 here means a stale or corrupted session slipped
 * through — not a normal unauthenticated visit.
 *
 * Throws `UnauthorizedError` rather than redirecting: pages should use `requireUser()` below
 * instead, which does redirect.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const opts = await serverApiOptions();
  try {
    const { user } = await api.user.get(opts);
    if (!user) throw new UnauthorizedError();
    return user as CurrentUser;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw new UnauthorizedError();
    throw err;
  }
}

/** Same as getCurrentUser(), but for Server Component pages — redirects to /login on failure instead of throwing. */
export async function requireUser(): Promise<CurrentUser> {
  try {
    return await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    throw err;
  }
}
