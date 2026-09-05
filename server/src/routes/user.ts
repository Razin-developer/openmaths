import { Hono } from "hono";
import bcrypt from "bcryptjs";
import type { Prisma } from "@openmaths/db";
import { prisma } from "@openmaths/db";
import { checkRateLimit } from "@openmaths/db/auth/rateLimit";
import { BCRYPT_COST } from "@openmaths/db/auth/passwordPolicy";
import { generateTotpSecret, buildTotpUri, verifyTotpCode, generateBackupCodes } from "@openmaths/db/auth/totp";
import { revokeAllSessions } from "@openmaths/db/auth/sessions";
import { isPasswordBreached } from "@openmaths/shared/auth/breachCheck";
import { requireAuth } from "../middleware/auth";

export const userRoutes = new Hono();

const SAFE_USER_SELECT = {
  id: true,
  displayName: true,
  email: true,
  defaultModelId: true,
  imageModelId: true,
  fileModelId: true,
  drawingModelId: true,
  fontSize: true,
  fontFamily: true,
  personalization: true,
  createdAt: true,
} as const;

// PRD "Split into app + server" P4 — `app`'s `currentUser.ts` (used by every remaining SSR page
// for its auth gate) now resolves the signed-in user via this same route instead of a direct
// Prisma call, so `hasPassword`/`mfaEnabled` are included as derived booleans (Settings > Profile
// needs both) — never the raw `passwordHash`/`totpSecret` themselves, which are select()ed only
// to compute them and stripped before the response leaves this handler.
const SELF_USER_SELECT = { ...SAFE_USER_SELECT, passwordHash: true, totpEnabled: true } as const;

userRoutes.get("/user", requireAuth, async (c) => {
  const currentUser = c.get("user");
  const user = await prisma.user.findUnique({ where: { id: currentUser.id }, select: SELF_USER_SELECT });
  if (!user) return c.json({ user: null });
  const { passwordHash, totpEnabled, ...safe } = user;
  return c.json({ user: { ...safe, hasPassword: Boolean(passwordHash), mfaEnabled: totpEnabled } });
});

userRoutes.patch("/user", requireAuth, async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  const user = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      displayName: typeof body?.displayName === "string" ? body.displayName : undefined,
      defaultModelId: typeof body?.defaultModelId === "string" ? body.defaultModelId : undefined,
      imageModelId: typeof body?.imageModelId === "string" ? body.imageModelId : undefined,
      fileModelId: typeof body?.fileModelId === "string" ? body.fileModelId : undefined,
      drawingModelId: typeof body?.drawingModelId === "string" ? body.drawingModelId : undefined,
      fontSize: typeof body?.fontSize === "string" ? body.fontSize : undefined,
      fontFamily: typeof body?.fontFamily === "string" ? body.fontFamily : undefined,
      personalization:
        body?.personalization && typeof body.personalization === "object"
          ? (body.personalization as Prisma.InputJsonValue)
          : undefined,
    },
    select: SAFE_USER_SELECT,
  });

  return c.json({ user });
});

/** "Sign out of all devices" (F8) — bumps User.tokenVersion so every previously-issued JWT
 * (including the one making this request) fails its next revalidation. */
userRoutes.delete("/user/sessions", requireAuth, async (c) => {
  const user = c.get("user");
  await revokeAllSessions(user.id);
  return c.json({ ok: true });
});

userRoutes.post("/user/password", requireAuth, async (c) => {
  const currentUser = c.get("user");

  // F3 — this route had no throttling despite being a password-guess surface for an already-
  // authenticated attacker (e.g. a stolen session) probing for the real current password.
  const rateLimit = await checkRateLimit(`password-change:${currentUser.id}`, 5, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `Too many attempts — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return c.json({ error: "New password must be at least 8 characters" }, 400);
  }
  // F12 — same breach check as signup.
  if (await isPasswordBreached(newPassword)) {
    return c.json({ error: "That password has appeared in a data breach — choose a different one." }, 400);
  }

  const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
  if (!user) return c.json({ error: "Not found" }, 404);

  // F14 — every account is created via signup with a password, so passwordHash should never
  // actually be null; if it somehow is, that's a broken account state, not a bypass to allow.
  if (!user.passwordHash) {
    return c.json({ error: "This account has no password set — contact support." }, 400);
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Current password is incorrect" }, 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await prisma.user.update({ where: { id: currentUser.id }, data: { passwordHash } });
  // F8 — a password change is exactly the moment every OTHER session should stop working; this
  // also invalidates the session making this very request, same as the original route.
  await revokeAllSessions(currentUser.id);

  return c.json({ ok: true });
});

/** Step 1 of MFA setup (F13): mint a fresh secret and hand back the otpauth:// URI. MFA isn't
 * actually enabled yet — that's /user/mfa/enable, once the user proves they scanned it. */
userRoutes.post("/user/mfa/setup", requireAuth, async (c) => {
  const user = c.get("user");
  const rateLimit = await checkRateLimit(`mfa-setup:${user.id}`, 10, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `Too many attempts — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret, totpEnabled: false } });

  return c.json({ secret, otpauthUrl: buildTotpUri(secret, user.email ?? user.id) });
});

/** Step 2 of MFA setup: proves the user actually scanned/entered the secret from /setup, then
 * turns MFA on and issues one-time backup codes — shown exactly once, stored only as bcrypt
 * hashes thereafter (same as passwords). */
userRoutes.post("/user/mfa/enable", requireAuth, async (c) => {
  const user = c.get("user");
  const rateLimit = await checkRateLimit(`mfa-enable:${user.id}`, 10, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `Too many attempts — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code : "";

  if (!user.totpSecret) {
    return c.json({ error: "Start setup first — no pending secret." }, 400);
  }
  if (!verifyTotpCode(user.totpSecret, code)) {
    return c.json({ error: "That code didn't match — check your authenticator app and try again." }, 400);
  }

  const backupCodes = generateBackupCodes();
  const hashed = await Promise.all(backupCodes.map((bc) => bcrypt.hash(bc, BCRYPT_COST)));
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true, totpBackupCodes: hashed } });

  return c.json({ ok: true, backupCodes });
});

/** Turning MFA off requires the current password (not just an active session) — same "prove
 * you're really you" bar as changing the password itself. */
userRoutes.post("/user/mfa/disable", requireAuth, async (c) => {
  const user = c.get("user");
  const rateLimit = await checkRateLimit(`mfa-disable:${user.id}`, 5, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `Too many attempts — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";

  if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.json({ error: "Incorrect password" }, 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] },
  });

  return c.json({ ok: true });
});
