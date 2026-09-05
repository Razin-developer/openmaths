import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238, built on RFC 4226's HOTP) implemented directly against Node's `crypto` —
 * deliberately no `otplib`/`speakeasy` dependency: the algorithm is ~30 lines of well-specified
 * HMAC-SHA1 math, this environment has no outbound npm registry access to add a package anyway,
 * and a hand-rolled implementation of a public RFC is a smaller trust surface than a third-party
 * one for something this security-sensitive. Compatible with Google Authenticator / Authy / 1Password
 * and any other standard authenticator app.
 */

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, "0");
    out += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** A fresh random secret, base32-encoded (the format authenticator apps expect). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20)); // 160 bits, the RFC 4226-recommended HMAC-SHA1 key size
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binCode % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/**
 * Verifies a 6-digit code against the secret, tolerating ±1 time step (±30s) for clock drift
 * between the server and the user's device — the standard, universally-implemented allowance.
 * Constant-time compare against each candidate so this doesn't reopen a timing side-channel.
 */
export function verifyTotpCode(secret: string, code: string, windowSteps = 1): boolean {
  const trimmed = code.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(trimmed)) return false;
  const counter = Math.floor(Date.now() / 1000 / PERIOD_SECONDS);
  const candidate = Buffer.from(trimmed, "utf8");
  for (let step = -windowSteps; step <= windowSteps; step++) {
    const expected = Buffer.from(hotp(secret, counter + step), "utf8");
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) return true;
  }
  return false;
}

/** The `otpauth://` URI an authenticator app scans (as a QR code) or accepts pasted for manual
 * setup — this app doesn't render an actual QR image (no image-generation dependency available
 * offline either), so setup shows this URI as copyable text plus the raw secret for manual entry,
 * both of which every authenticator app supports. */
export function buildTotpUri(secret: string, accountLabel: string, issuer = "openmaths"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(PERIOD_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Backup/recovery codes — shown once at MFA-enable time, stored only as bcrypt hashes
 * thereafter (same as passwords), each consumed on use. Formatted with a dash for readability
 * (e.g. "a1b2-c3d4"), 8 hex chars of real entropy each. */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const hex = randomBytes(4).toString("hex");
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
  });
}
