import { randomBytes } from "node:crypto";
import { prisma } from "../index";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — shorter than email verification's 24h since this
// grants account takeover if intercepted, not just email-linkage; tighter window is deliberate.

/**
 * Creates a one-time password-reset token (PRD "Auth & Security Audit" F13) and returns the
 * absolute URL to visit to consume it. Same no-SMTP-infra situation as email verification: logged
 * server-side, and — non-production only — returned directly to the caller so the flow is
 * testable end to end without a mail server.
 *
 * `origin` should be `app`'s origin — this link points at `app`'s client-rendered `/reset-password`
 * page, not a `server` API route (unlike `createVerificationLink`, whose link is consumed by
 * `server`'s own `GET /auth/verify`).
 */
export async function createPasswordResetLink(email: string, origin: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: { email, token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  const url = `${origin}/reset-password?token=${token}`;
  console.log(`[password-reset] ${email} -> ${url}`);
  return url;
}

/** Validates a token without consuming it (used to decide whether to render the reset form at
 * all, before the user has typed a new password) — returns the email it's for, or null. */
export async function peekPasswordResetToken(token: string): Promise<string | null> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) return null;
  return record.email;
}

/** Consumes a reset token (one-time use — deleted whether or not the caller goes on to actually
 * change the password, since a token that's been looked at once is treated as spent). Returns
 * the email on success, null for invalid/expired. */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record) return null;
  await prisma.passwordResetToken.delete({ where: { token } }).catch(() => {});
  if (record.expiresAt < new Date()) return null;
  return record.email;
}
