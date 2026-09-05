import { randomBytes } from "node:crypto";
import { prisma } from "../index";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Creates a one-time email-verification token (PRD "Auth & Security Audit" F1) and returns the
 * absolute URL to visit to consume it. No SMTP/email infra exists in this app yet — the caller is
 * responsible for getting this URL to the user however it can (currently: logged server-side, and
 * returned directly in the signup response in non-production so the flow is testable end to end).
 *
 * `origin` should be wherever `GET /auth/verify` actually lives — `server`'s own origin, per the
 * PRD "Split into app + server" split, not `app`'s (unlike `createPasswordResetLink`, whose link
 * points at an `app`-rendered page).
 */
export async function createVerificationLink(email: string, origin: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.emailVerificationToken.create({
    data: { email, token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  const url = `${origin}/auth/verify?token=${token}`;
  console.log(`[email-verification] ${email} -> ${url}`);
  return url;
}

/** Consumes a verification token: marks the matching user verified and deletes the token
 * (one-time use). Returns the verified email on success, or null for an invalid/expired/
 * already-used token. */
export async function consumeVerificationToken(token: string): Promise<string | null> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) {
    if (record) await prisma.emailVerificationToken.delete({ where: { token } }).catch(() => {});
    return null;
  }
  await prisma.$transaction([
    prisma.user.updateMany({ where: { email: record.email }, data: { emailVerified: new Date() } }),
    prisma.emailVerificationToken.delete({ where: { token } }),
  ]);
  return record.email;
}
