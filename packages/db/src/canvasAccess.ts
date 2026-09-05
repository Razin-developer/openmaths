import type { Prisma } from "./index";
import { prisma } from "./index";

/** Every caller of `canvasAccessWhere`/`resolveCanvasRole` gets this from `getCurrentUser()`,
 * which returns the full Prisma `User` row — so `emailVerified` is always already in hand, this
 * just documents the contract and forces every call site to acknowledge it exists. */
export interface AccessUser {
  id: string;
  email: string | null;
  emailVerified: Date | null;
}

/**
 * A canvas is accessible if the user owns it OR their (verified) email was added as a
 * collaborator. Returns a Prisma `where` fragment usable directly on `Canvas`
 * ({...canvasAccessWhere(...)}) or nested under a relation ({ canvas: canvasAccessWhere(...) })
 * on Block/Connection queries.
 *
 * Email-based access requires `emailVerified` (PRD "Auth & Security Audit" F1): a share is
 * granted to an *email address*, but nothing before this proved the account requesting access
 * actually controls that inbox — an attacker who registers a victim's email before the victim
 * does would otherwise inherit every canvas already shared to it. An unverified account still
 * has full access to canvases it *owns*; it just can't claim anyone else's shares yet.
 */
export function canvasAccessWhere(user: AccessUser): Prisma.CanvasWhereInput {
  const email = user.email?.toLowerCase() ?? null;
  return {
    OR: [
      { userId: user.id },
      ...(email && user.emailVerified ? [{ collaborators: { some: { email } } }] : []),
    ],
  };
}

export type CanvasRole = "owner" | "editor" | "commenter" | "viewer";

const ROLE_RANK: Record<CanvasRole, number> = { viewer: 0, commenter: 1, editor: 2, owner: 3 };

/** True when `role` meets or exceeds `min` in the OWNER > EDITOR > COMMENTER > VIEWER hierarchy —
 * `role: null` (no access at all) never satisfies any minimum. */
export function roleAtLeast(role: CanvasRole | null, min: CanvasRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/**
 * The single source of truth for "what can this user do on this canvas" (PRD "Sharing,
 * Collaboration & Access Roles" §7) — owner beats any collaborator row; otherwise the matching
 * collaborator's role, gated on a verified email (see `canvasAccessWhere`'s doc comment — F1).
 * Returns `null` when the user has no access at all (owner check fails and no collaborator row
 * matches their verified email) — every route gating a mutation should treat `null` the same as
 * "not found" (404), not "403", so an unauthorized caller can't even confirm the canvas exists.
 */
export async function resolveCanvasRole(user: AccessUser, canvasId: string): Promise<CanvasRole | null> {
  const email = user.email?.toLowerCase() ?? null;
  const emailMatches = !!(email && user.emailVerified);
  const canvas = await prisma.canvas.findUnique({
    where: { id: canvasId },
    select: {
      userId: true,
      collaborators: emailMatches ? { where: { email }, select: { role: true } } : false,
    },
  });
  if (!canvas) return null;
  if (canvas.userId === user.id) return "owner";
  const collaborator = Array.isArray(canvas.collaborators) ? canvas.collaborators[0] : undefined;
  if (!collaborator) return null;
  return collaborator.role.toLowerCase() as CanvasRole;
}

/**
 * Convenience wrapper for the common "resolve role, reject if it doesn't meet the minimum" check
 * every mutation route needs (PRD §7 — "gate each route by required role"). Returns the resolved
 * role on success (so a caller that also wants to know "was this the owner" doesn't need a second
 * lookup) or `null` if access should be denied — callers should return 404 (canvas not visible at
 * all) when the raw role is `null`, and 403 (visible but insufficient role) when it's non-null but
 * below `min`; this helper collapses both to `null` for callers that just need a single check.
 */
export async function requireCanvasRole(user: AccessUser, canvasId: string, min: CanvasRole): Promise<CanvasRole | null> {
  const role = await resolveCanvasRole(user, canvasId);
  return roleAtLeast(role, min) ? role : null;
}
