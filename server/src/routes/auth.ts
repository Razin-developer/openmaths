import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@openmaths/db";
import { checkRateLimit } from "@openmaths/db/auth/rateLimit";
import { BCRYPT_COST } from "@openmaths/db/auth/passwordPolicy";
import { verifyTotpCode } from "@openmaths/db/auth/totp";
import { revokeAllSessions } from "@openmaths/db/auth/sessions";
import { createVerificationLink, consumeVerificationToken } from "@openmaths/db/auth/verification";
import { createPasswordResetLink, peekPasswordResetToken, consumePasswordResetToken } from "@openmaths/db/auth/passwordReset";
import { isPasswordBreached } from "@openmaths/shared/auth/breachCheck";
import { notifyCanvasShared } from "@openmaths/db/notifications";
import { issueSession, clearSession } from "../lib/auth/session";
import { env } from "../env";

/** The `app` origin to redirect/link back to — first entry of the CORS allowlist, same
 * derivation `middleware/cors.ts` uses for its own fallback. */
const APP_ORIGIN = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)[0] ?? "";

/**
 * PRD "Split into app + server" P2 — Hono becomes the session issuer. Ported verbatim from
 * `app/src/auth.ts`'s Credentials `authorize()` (same rate-limit buckets, same timing-safe dummy
 * bcrypt compare, same MFA/backup-code step-up logic) — only the LAST step changes: instead of
 * returning a user object for NextAuth's own `jwt()` callback to wrap, this calls `issueSession()`
 * directly. `app`'s `auth.ts` is completely untouched; its `jwt()` callback keeps re-validating
 * whatever token it finds (Hono-issued or, during any transition window, one it issued itself)
 * exactly as before — see session.ts's own comment for why that compatibility holds.
 *
 * Known, accepted limitation carried over from `app`'s own rate limiter (PRD F11's own doc
 * comment): the default `InMemoryRateLimitStore` is a plain in-process Map — `server` and `app`
 * do NOT share rate-limit buckets across the split (two separate processes). Not a regression
 * introduced by this port (the store was already swappable-but-unshared before), and the real
 * fix (`PostgresRateLimitStore`, already implemented, just not wired in) is explicitly P5's job.
 */
const DUMMY_HASH = bcrypt.hashSync("openmaths-dummy-password-for-timing-safety", BCRYPT_COST);

const LoginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

export const authRoutes = new Hono();

authRoutes.post("/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid credentials" }, 400);

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  const totpCode = parsed.data.totpCode?.trim() ?? "";
  if (!email || !password) return c.json({ error: "Invalid credentials" }, 400);

  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipOk = (await checkRateLimit(`login-ip:${ip}`, 20, 15 * 60 * 1000)).allowed;
  const emailOk = (await checkRateLimit(`login-email:${email}`, 5, 15 * 60 * 1000)).allowed;
  if (!ipOk || !emailOk) {
    await bcrypt.compare(password, DUMMY_HASH);
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !valid) return c.json({ error: "Invalid credentials" }, 401);

  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode) return c.json({ error: "MFA code required" }, 401);
    const codeOk = verifyTotpCode(user.totpSecret, totpCode);
    if (!codeOk) {
      let matchedIndex = -1;
      for (let i = 0; i < user.totpBackupCodes.length; i++) {
        if (await bcrypt.compare(totpCode, user.totpBackupCodes[i])) {
          matchedIndex = i;
          break;
        }
      }
      if (matchedIndex === -1) return c.json({ error: "Invalid credentials" }, 401);
      const remaining = user.totpBackupCodes.filter((_, i) => i !== matchedIndex);
      await prisma.user.update({ where: { id: user.id }, data: { totpBackupCodes: remaining } });
    }
  }

  await issueSession(c, { id: user.id, tokenVersion: user.tokenVersion, validatedAt: Date.now() });
  return c.json({ ok: true, user: { id: user.id, email: user.email, name: user.displayName } });
});

authRoutes.post("/auth/logout", async (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

const SignupSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(80),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

authRoutes.post("/auth/signup", async (c) => {
  // PRD "Auth & Security Audit" F3 — signups had no throttling at all; keyed by IP so a spray of
  // account-creation attempts (or the enumeration probe in F4) can't run unbounded.
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await checkRateLimit(`signup:${ip}`, 10, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `Too many signup attempts — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }
  const { displayName, email, password } = parsed.data;

  // PRD F12 — reject a password known to be in a public breach dump, checked before the
  // existence lookup so this branch's timing/behavior doesn't itself leak whether the email is
  // registered. Fails open if the HIBP API is unreachable — see breachCheck.ts.
  if (await isPasswordBreached(password)) {
    return c.json({ error: "That password has appeared in a data breach — choose a different one." }, 400);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  // Always pay the bcrypt cost regardless of outcome (F4) — hashing is the dominant cost of this
  // route, so returning immediately when the account already exists would reopen a timing
  // side-channel just like the one closed on login above.
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  if (existing) {
    // Neutral response (F4 AC4: "signup/login responses don't confirm account existence") — same
    // 200 shape as a genuine signup, just without accountCreated/devVerifyUrl.
    return c.json({ ok: true, accountCreated: false });
  }

  const user = await prisma.user.create({ data: { email, displayName, passwordHash } });

  // Backfill any invites that arrived before this account existed.
  try {
    const pendingInvites = await prisma.canvasCollaborator.findMany({
      where: { email, status: "PENDING" },
      include: { canvas: { select: { title: true, userId: true, user: { select: { displayName: true, email: true } } } } },
    });
    if (pendingInvites.length > 0) {
      await prisma.canvasCollaborator.updateMany({ where: { email, status: "PENDING" }, data: { status: "ACTIVE" } });
      for (const invite of pendingInvites) {
        await notifyCanvasShared({
          userId: user.id,
          canvasId: invite.canvasId,
          canvasTitle: invite.canvas.title,
          actorId: invite.canvas.userId,
          actorName: invite.canvas.user.displayName ?? invite.canvas.user.email,
          role: invite.role.toLowerCase(),
        });
      }
    }
  } catch (err) {
    console.error("[signup] failed to backfill pending invites:", err);
  }

  // Email verification (F1) — until this link is followed, the account can't claim any canvas
  // shared to its email. No SMTP infra exists yet: the link is logged server-side, and — non-
  // production only — handed back directly in the response so the flow is testable end to end.
  let devVerifyUrl: string | undefined;
  try {
    const origin = new URL(c.req.url).origin;
    const url = await createVerificationLink(email, origin);
    if (process.env.NODE_ENV !== "production") devVerifyUrl = url;
  } catch (err) {
    console.error("[signup] failed to create verification link:", err);
  }

  // PRD "Split into app + server" P2 — this server issues sessions directly, same as /auth/login.
  await issueSession(c, { id: user.id, tokenVersion: user.tokenVersion, validatedAt: Date.now() });

  return c.json({ ok: true, accountCreated: true, devVerifyUrl });
});

/**
 * Consumes an email-verification link (F1). A GET is appropriate here (unlike the share-link
 * redemption in F7) — this only ever *upgrades* the clicking account's own verification status,
 * it can't grant access to anything on someone else's behalf. Redirects to `app`'s /login page
 * (this link is meant to be clicked directly from an email, landing on this server's origin).
 */
authRoutes.get("/auth/verify", async (c) => {
  const token = new URL(c.req.url).searchParams.get("token");
  if (!token) return c.redirect(`${APP_ORIGIN}/login?verify=missing`);

  const email = await consumeVerificationToken(token);
  if (!email) return c.redirect(`${APP_ORIGIN}/login?verify=invalid`);

  return c.redirect(`${APP_ORIGIN}/login?verify=success`);
});

const ForgotPasswordSchema = z.object({ email: z.email().trim().toLowerCase() });

/**
 * PRD F13 — password reset. Always returns the same neutral 200 shape regardless of whether the
 * email is registered (F4's enumeration-safety principle). The account holder gets the real
 * signal via devResetUrl (non-production) / the server log.
 */
authRoutes.post("/auth/forgot-password", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await checkRateLimit(`forgot-password:${ip}`, 10, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `Too many attempts — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = ForgotPasswordSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Enter a valid email address" }, 400);
  const { email } = parsed.data;

  // Also throttled per-email so repeatedly requesting resets for one account can't be used to
  // spam its inbox or churn through tokens.
  const emailRateLimit = await checkRateLimit(`forgot-password-email:${email}`, 5, 15 * 60 * 1000);

  let devResetUrl: string | undefined;
  if (emailRateLimit.allowed) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      try {
        const url = await createPasswordResetLink(email, APP_ORIGIN);
        if (process.env.NODE_ENV !== "production") devResetUrl = url;
      } catch (err) {
        console.error("[forgot-password] failed to create reset link:", err);
      }
    }
  }

  return c.json({ ok: true, devResetUrl });
});

/** GET — used by the reset-password page to check a token is valid before rendering the form
 * (without consuming it, so refreshing the page doesn't burn the token). */
authRoutes.get("/auth/reset-password", async (c) => {
  const token = new URL(c.req.url).searchParams.get("token") ?? "";
  const email = token ? await peekPasswordResetToken(token) : null;
  return c.json({ valid: !!email });
});

/** POST — consumes the token and sets the new password. */
authRoutes.post("/auth/reset-password", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await checkRateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    c.header("Retry-After", String(rateLimit.retryAfterSeconds));
    return c.json({ error: `Too many attempts — try again in ${rateLimit.retryAfterSeconds}s.` }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return c.json({ error: "New password must be at least 8 characters" }, 400);
  }
  if (await isPasswordBreached(newPassword)) {
    return c.json({ error: "That password has appeared in a data breach — choose a different one." }, 400);
  }

  const email = await consumePasswordResetToken(token);
  if (!email) {
    return c.json({ error: "This reset link is invalid or has expired — request a new one." }, 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return c.json({ error: "This reset link is invalid or has expired — request a new one." }, 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  // A password reset is exactly F8's "kill every existing session" moment.
  await revokeAllSessions(user.id);

  return c.json({ ok: true });
});

/**
 * Lets the login form know, before submitting a password, whether it should show a TOTP field —
 * a narrower, accepted disclosure than full account-existence enumeration (F4).
 */
authRoutes.post("/auth/mfa-check", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await checkRateLimit(`mfa-check:${ip}`, 30, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    return c.json({ mfaRequired: false }, 200);
  }

  const body = await c.req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return c.json({ mfaRequired: false });

  const user = await prisma.user.findUnique({ where: { email }, select: { totpEnabled: true } });
  return c.json({ mfaRequired: !!user?.totpEnabled });
});
