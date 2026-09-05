import { createHash } from "node:crypto";

const HIBP_TIMEOUT_MS = 3000;

/**
 * PRD "Auth & Security Audit" F12 — checks a password against Have I Been Pwned's Pwned
 * Passwords range API using k-anonymity: only the first 5 hex characters of the SHA-1 hash are
 * ever sent, never the password or its full hash, so the API can't learn the actual password.
 *
 * Fails OPEN, not closed: if the API is unreachable, slow, or errors, this returns `false`
 * (treat as "not known-breached") rather than blocking signup/password-change on a third-party
 * dependency being up — a breached-password check is a quality improvement, not a security
 * boundary the app should become unavailable without.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { "Add-Padding": "true" },
    });
    clearTimeout(timeout);
    if (!res.ok) return false;

    const body = await res.text();
    return body.split("\n").some((line) => line.split(":")[0]?.trim() === suffix);
  } catch {
    return false;
  }
}
