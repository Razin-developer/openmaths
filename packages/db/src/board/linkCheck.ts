import { promises as dns } from "node:dns";
import { isIP } from "node:net";

const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 1_000_000; // 1MB — plenty for a <title>, caps a slow/huge-body DoS.
const ALLOWED_PORTS = new Set(["", "80", "443"]);

export interface LinkCheckResult {
  ok: boolean;
  status: number | null;
  title: string | null;
  favicon: string;
  hostname: string;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim().slice(0, 200) : null;
}

/**
 * SSRF guard (PRD "Auth & Security Audit" F2) — blocks the well-known private/loopback/
 * link-local/reserved ranges, IPv4 and IPv6, including the cloud-metadata address
 * (169.254.169.254) and IPv4-mapped IPv6 forms of the same. Not an exhaustive RFC audit of every
 * reserved block, but covers the realistic internal-network/metadata-exfil threat model.
 */
function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 0) return true; // "this network"
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && parts[2] === 0) return true; // IETF protocol assignments
    if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
    if (a >= 224) return true; // multicast (224-239) + reserved (240-255)
    return false;
  }
  if (family === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized === "::") return true; // unspecified
    if (normalized.startsWith("fe80:") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local (fc00::/7)
    if (normalized.startsWith("ff")) return true; // multicast
    // IPv4-mapped (::ffff:a.b.c.d) — re-check the embedded IPv4 address.
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }
  return true; // unrecognized — fail closed
}

async function assertSafeHost(hostname: string): Promise<void> {
  // A literal IP in the URL — validate directly, no DNS round trip.
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error("blocked host");
    return;
  }
  // Resolve ALL records (A + AAAA) and reject if any single one is blocked — a multi-answer or
  // DNS-rebinding response that mixes one public and one private address must still fail closed.
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error("no DNS records");
  for (const record of records) {
    if (isBlockedIp(record.address)) throw new Error("blocked host");
  }
}

function assertAllowedUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("blocked protocol");
  if (!ALLOWED_PORTS.has(url.port)) throw new Error("blocked port");
}

/** Reads a response body up to `MAX_RESPONSE_BYTES`, decoding what was read even if the stream
 * was cut short — good enough to find a <title> without buffering an unbounded response. */
async function readCappedText(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      chunks.push(value);
      if (total >= MAX_RESPONSE_BYTES) {
        reader.cancel().catch(() => {});
        break;
      }
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

/**
 * Fetches a URL to check it's actually reachable (used both for the single-link preview and to
 * filter out dead links before adding them as browser tabs during a web-search sync). Returns
 * null only for a URL that doesn't even parse or resolves to a blocked host; a real but
 * failing/erroring site still gets a result with ok:false so callers can tell "invalid URL" apart
 * from "valid URL, site is down".
 *
 * SSRF-hardened (PRD "Auth & Security Audit" F2): validates the host (and port/protocol) before
 * every fetch AND before following each redirect — `fetch`'s own `redirect: "follow"` would
 * otherwise happily land on a private/metadata address one hop after an innocent-looking public
 * URL passed the initial check (the exact DNS-rebinding/redirect-bypass class the PRD flags).
 */
export async function checkUrl(rawUrl: string): Promise<LinkCheckResult | null> {
  let target: URL;
  try {
    target = new URL(rawUrl);
    assertAllowedUrl(target);
  } catch {
    return null;
  }

  const favicon = `https://www.google.com/s2/favicons?domain=${target.hostname}&sz=64`;

  try {
    let current = target;
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertSafeHost(current.hostname);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        res = await fetch(current.toString(), { signal: controller.signal, redirect: "manual" });
      } finally {
        clearTimeout(timeout);
      }
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        const next = new URL(res.headers.get("location")!, current);
        assertAllowedUrl(next);
        current = next;
        continue;
      }
      break;
    }
    if (!res) return { ok: false, status: null, title: null, favicon, hostname: target.hostname };

    const contentType = res.headers.get("content-type") ?? "";
    const title = res.ok && contentType.includes("text/html") ? extractTitle(await readCappedText(res)) : null;
    return { ok: res.ok, status: res.status, title, favicon, hostname: target.hostname };
  } catch {
    return { ok: false, status: null, title: null, favicon, hostname: target.hostname };
  }
}
