import { NextResponse } from "next/server";
import { auth } from "@/auth";

// "/" is public too (the new landing page — visible logged-out, not force-gated like every other
// route) but is NOT in AUTH_ONLY_ROUTES below: unlike /login and /signup, redirecting an
// authenticated visitor away from "/" to "/" would be a same-URL redirect to itself. The landing
// page instead redirects itself to /dashboard when there's a session (see app/page.tsx) — cleaner
// than special-casing that here, and it means "/" never needs middleware-level auth branching.
const PUBLIC_ROUTES = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password"]);
// Pages that make no sense to view while already signed in — bounced to "/" if you are.
const AUTH_ONLY_ROUTES = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Content-Security-Policy, enforced (PRD "Auth & Security Audit" F5 — this replaces the earlier
 * Report-Only version now that script-src is nonce-based instead of 'unsafe-inline'). A fresh
 * nonce is generated per request and threaded two ways: into this header, and into an `x-nonce`
 * request header that `layout.tsx` reads via `headers()` to nonce its own `<Script>` tags
 * (theme/prefs flash-prevention). Next's own framework-inserted scripts (hydration bootstrap,
 * chunk loaders) pick up the same nonce automatically once it's present in the CSP response
 * header — no extra wiring needed for those. `strict-dynamic` lets a nonce'd script load further
 * scripts it inserts (Next's runtime does this for chunks); browsers without strict-dynamic
 * support fall back to the 'self' allowlist.
 *
 * style-src keeps 'unsafe-inline' deliberately — this app uses React inline `style={{}}` attrs
 * throughout (canvas positioning, dynamic sizing); locking that down would need converting every
 * one to a CSS variable/class, a much larger change than this audit pass covers. Script injection
 * is the higher-severity axis and is the one actually locked down here. */
function buildCsp(nonce: string): string {
  // React/Next's dev-mode tooling (Fast Refresh, stack-trace reconstruction) genuinely needs
  // eval() and only in dev — "React will never use eval() in production mode" per its own
  // console warning. Scoping 'unsafe-eval' to non-production keeps the real, deployed policy
  // exactly as strict as intended while not degrading local development.
  const devEval = process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : "";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.google.com",
    "font-src 'self' data:",
    // https://replicate.delivery hosts every narration clip's audio (Replicate's own delivery
    // CDN — the hackai-sdk/proxy TTS call returns a URL there, never uploaded to our own storage,
    // see lib/ai/tts.ts). connect-src needs it too, not just media-src: the voiceover video
    // export path (lib/board/videoExport.ts's fetchAudioBuffer) does a real fetch() of the clip
    // to decode it into an AudioBuffer, which connect-src governs, not media-src.
    //
    // https://cdn.jsdelivr.net — every diagram's on-canvas text (drei's <Text>, wrapping
    // troika-three-text, used in ~18 files under components/engine/primitives) falls back to
    // unicode-font-resolver for glyph coverage it doesn't have embedded, which fetch()es its
    // codepoint index and .woff font files from this CDN by default (troika-three-text.esm.js's
    // hardcoded default `dataUrl`). Was silently blocked by this CSP the whole time — confirmed
    // live via console errors ("violates ... connect-src 'self'") on every diagram render; the
    // catch handler swallows the failure, so this was a real bug, not just log noise, degrading
    // (not necessarily breaking outright) whatever glyphs the fallback path was needed for.
    // PRD "Split into app + server" P1 — the browser now also talks directly to the Hono API
    // server (topology B, a separate origin) for the routes ported there so far; without this,
    // every fetch() to it is silently blocked by the CSP (confirmed live: "Failed to fetch" with
    // no other error, the classic CSP-blocked-fetch symptom — the browser's console does log a
    // CSP violation, but a plain try/catch around fetch() never sees WHY it failed).
    `connect-src 'self' ${API_BASE_URL} https://replicate.delivery https://cdn.jsdelivr.net`,
    "media-src 'self' blob: https://replicate.delivery",
    "worker-src 'self' blob:",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Gates every page behind a real session now that auth is NextAuth-backed. Only reads
 * the signed JWT cookie (no DB call) — Proxy runs on Node.js in this fork, but we still
 * keep this an optimistic check per Next.js's auth guidance; routes re-verify via
 * getCurrentUser().
 */
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isAuthed = !!request.auth;
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const isAuthRoute = pathname.startsWith("/api/auth");

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  function withCsp(response: NextResponse): NextResponse {
    response.headers.set("Content-Security-Policy", buildCsp(nonce));
    return response;
  }

  if (isAuthRoute) return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));

  if (!isAuthed && !isPublicRoute) {
    return withCsp(NextResponse.redirect(new URL("/login", request.nextUrl)));
  }

  if (isAuthed && AUTH_ONLY_ROUTES.has(pathname)) {
    return withCsp(NextResponse.redirect(new URL("/", request.nextUrl)));
  }

  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
