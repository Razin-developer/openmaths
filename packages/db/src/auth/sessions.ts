import { prisma } from "../index";

/**
 * Session revocation (PRD "Auth & Security Audit" F8). JWT sessions carry no server-side state
 * by default, so there's normally nothing to "revoke" — the token is valid until it expires no
 * matter what happens to the account afterward. `User.tokenVersion` is the escape hatch: every
 * issued token is stamped with the version that was current when it was minted, and the
 * jwt-verification path compares that stamp against the current column on its periodic
 * revalidation pass. Bumping this column makes every token minted before the bump fail that
 * comparison and get treated as unauthenticated, without needing a session table or a live
 * revocation list.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}
