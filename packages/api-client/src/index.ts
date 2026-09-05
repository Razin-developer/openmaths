/**
 * PRD "Split into app + server" P3 — the base-URL typed API client. One client for both the
 * browser (relies on the browser's own cookie jar + `credentials: 'include'`) and SSR (`app`'s
 * Server Components have no cookie jar of their own — the incoming request's `Cookie` header must
 * be forwarded explicitly, so `opts.cookie` exists for exactly that; framework-agnostic on
 * purpose, no `next/headers` import here — the caller passes `cookies().toString()` in).
 *
 * Scope note: only wraps the routes that actually exist on `server` today (models, notifications,
 * canvases list/get, auth login/logout — P1/P2's output). Everything still served by `app`'s own
 * `/api/*` keeps using plain `fetch()` at its existing call sites until ported — this client
 * grows domain-by-domain the same way `server`'s routes did, not in one big-bang pass.
 */

export interface SkillData {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions: string;
  isBuiltIn: boolean;
}

export interface ApiClientOptions {
  /** Overrides `NEXT_PUBLIC_API_BASE_URL` / the built-in dev default — mainly for tests. */
  baseUrl?: string;
  /** SSR only: the incoming request's `Cookie` header, forwarded so `server` sees the same
   * session the browser would have sent itself. Ignored in the browser (the browser's own cookie
   * jar + `credentials: 'include'` already does this). */
  cookie?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    const message = typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : `Request failed with status ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const isServer = typeof window === "undefined";

function resolveBaseUrl(opts?: ApiClientOptions): string {
  return opts?.baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

function buildRequestInit(init: RequestInit, opts?: ApiClientOptions): RequestInit {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  // SSR has no ambient cookie jar to rely on — forward the caller-supplied one explicitly.
  // In the browser, `credentials: 'include'` does the equivalent job via the real cookie jar.
  if (isServer && opts?.cookie) headers.set("Cookie", opts.cookie);
  return { ...init, headers, credentials: isServer ? undefined : "include" };
}

async function request<T>(path: string, init: RequestInit = {}, opts?: ApiClientOptions): Promise<T> {
  const res = await fetch(`${resolveBaseUrl(opts)}${path}`, buildRequestInit(init, opts));

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

/** For NDJSON/streaming endpoints (e.g. `/narrate`, `/blocks/:id/messages`) — returns the raw
 * `Response` so the caller can read `res.body`'s reader itself, same as this app's pre-split
 * `streamMessages.ts`/`narrationStore.ts` fetch calls did. Still throws `ApiError` on a non-OK
 * status (parsing whatever JSON error body the route sent), so callers don't need a second
 * ok-check branch. */
async function rawRequest(path: string, init: RequestInit = {}, opts?: ApiClientOptions): Promise<Response> {
  const res = await fetch(`${resolveBaseUrl(opts)}${path}`, buildRequestInit(init, opts));
  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json") ? await res.json().catch(() => null) : null;
    throw new ApiError(res.status, body);
  }
  return res;
}

export interface ModelSummary {
  id: string;
}

export interface NotificationsResponse {
  notifications: unknown[];
  unreadCount: number;
}

export interface JoinPrompt {
  canvasId: string;
  token: string;
  canvasTitle: string;
  ownerName: string | null;
  role: string;
}

/** Exactly one of `canvas`/`role` or `joinPrompt` is present — mirrors the SSR page's original
 * three-way branch (accessible / valid-share-link-but-not-yet-joined / neither, a 404 the caller
 * catches via `ApiError`). */
export type CanvasGetResponse = { canvas: unknown; role: string; joinPrompt?: undefined } | { canvas?: undefined; role?: undefined; joinPrompt: JoinPrompt };

export const api = {
  models: {
    list: (opts?: ApiClientOptions) => request<{ models: ModelSummary[] }>("/models", {}, opts),
  },
  notifications: {
    list: (canvasId?: string, opts?: ApiClientOptions) =>
      request<NotificationsResponse>(canvasId ? `/notifications?canvasId=${encodeURIComponent(canvasId)}` : "/notifications", {}, opts),
    markRead: (data: { id?: string; read?: boolean } = {}, opts?: ApiClientOptions) =>
      request<{ ok: true }>("/notifications/read", { method: "POST", body: JSON.stringify(data) }, opts),
  },
  linkPreview: {
    check: (url: string, opts?: ApiClientOptions) =>
      request<{ ok: boolean; status: number | null; title: string | null; favicon: string; hostname: string }>(
        `/link-preview?url=${encodeURIComponent(url)}`,
        {},
        opts
      ),
  },
  canvases: {
    list: (opts?: ApiClientOptions) => request<{ canvases: unknown[] }>("/canvases", {}, opts),
    /** `share`: forwards a share-link token (the `?share=` query param on the canvas page URL) so
     * `server` can fall back to the join-prompt response shape when the canvas isn't otherwise
     * accessible — see `server/src/routes/canvases.ts`'s doc comment for the full three-way
     * contract this mirrors from the pre-split SSR page. */
    get: (canvasId: string, share?: string, opts?: ApiClientOptions) =>
      request<CanvasGetResponse>(`/canvases/${encodeURIComponent(canvasId)}${share ? `?share=${encodeURIComponent(share)}` : ""}`, {}, opts),
    create: (title?: string, opts?: ApiClientOptions) =>
      request<{ canvas: unknown }>("/canvases", { method: "POST", body: JSON.stringify({ title }) }, opts),
    update: (canvasId: string, data: { title?: string }, opts?: ApiClientOptions) =>
      request<{ canvas: unknown }>(`/canvases/${encodeURIComponent(canvasId)}`, { method: "PATCH", body: JSON.stringify(data) }, opts),
    remove: (canvasId: string, opts?: ApiClientOptions) => request<{ ok: true }>(`/canvases/${encodeURIComponent(canvasId)}`, { method: "DELETE" }, opts),
  },
  connections: {
    create: (data: { canvasId: string; sourceBlockId: string; targetBlockId: string; label?: string }, opts?: ApiClientOptions) =>
      request<{ connection: unknown }>("/connections", { method: "POST", body: JSON.stringify(data) }, opts),
    remove: (connectionId: string, opts?: ApiClientOptions) =>
      request<{ ok: true }>(`/connections/${encodeURIComponent(connectionId)}`, { method: "DELETE" }, opts),
  },
  sharing: {
    get: (canvasId: string, opts?: ApiClientOptions) =>
      request<{ collaborators: unknown[]; shareLink: unknown }>(`/canvases/${encodeURIComponent(canvasId)}/share`, {}, opts),
    invite: (canvasId: string, data: { email: string; role: string }, opts?: ApiClientOptions) =>
      request<{ collaborator: unknown }>(`/canvases/${encodeURIComponent(canvasId)}/share`, { method: "POST", body: JSON.stringify(data) }, opts),
    updateRole: (canvasId: string, collaboratorId: string, role: string, opts?: ApiClientOptions) =>
      request<{ collaborator: unknown }>(
        `/canvases/${encodeURIComponent(canvasId)}/share/${encodeURIComponent(collaboratorId)}`,
        { method: "PATCH", body: JSON.stringify({ role }) },
        opts
      ),
    removeCollaborator: (canvasId: string, collaboratorId: string, opts?: ApiClientOptions) =>
      request<{ ok: true }>(`/canvases/${encodeURIComponent(canvasId)}/share/${encodeURIComponent(collaboratorId)}`, { method: "DELETE" }, opts),
    generateLink: (canvasId: string, data: { role: string; expiry: string }, opts?: ApiClientOptions) =>
      request<{ shareLink: unknown }>(`/canvases/${encodeURIComponent(canvasId)}/share-link`, { method: "POST", body: JSON.stringify(data) }, opts),
    revokeLink: (canvasId: string, opts?: ApiClientOptions) =>
      request<{ ok: true }>(`/canvases/${encodeURIComponent(canvasId)}/share-link`, { method: "DELETE" }, opts),
    join: (canvasId: string, token: string, opts?: ApiClientOptions) =>
      request<{ ok: true }>(`/canvases/${encodeURIComponent(canvasId)}/join`, { method: "POST", body: JSON.stringify({ token }) }, opts),
  },
  skills: {
    list: (opts?: ApiClientOptions) => request<{ skills: SkillData[] }>("/skills", {}, opts),
    create: (data: { name: string; description: string; instructions: string }, opts?: ApiClientOptions) =>
      request<{ skill: SkillData }>("/skills", { method: "POST", body: JSON.stringify(data) }, opts),
    update: (skillId: string, data: Partial<{ name: string; description: string; instructions: string }>, opts?: ApiClientOptions) =>
      request<{ skill: SkillData }>(`/skills/${encodeURIComponent(skillId)}`, { method: "PATCH", body: JSON.stringify(data) }, opts),
    remove: (skillId: string, opts?: ApiClientOptions) => request<{ ok: true }>(`/skills/${encodeURIComponent(skillId)}`, { method: "DELETE" }, opts),
    generate: (description: string, opts?: ApiClientOptions) =>
      request<{ draft: { name: string; description: string; instructions: string } }>(
        "/skills/generate",
        { method: "POST", body: JSON.stringify({ description }) },
        opts
      ),
  },
  blocks: {
    create: (
      data: { canvasId: string; parentBlockId?: string; positionX?: number; positionY?: number; kind?: string; url?: string },
      opts?: ApiClientOptions
    ) => request<{ block: unknown; connection: unknown }>("/blocks", { method: "POST", body: JSON.stringify(data) }, opts),
    get: (blockId: string, opts?: ApiClientOptions) => request<{ block: unknown }>(`/blocks/${encodeURIComponent(blockId)}`, {}, opts),
    update: (
      blockId: string,
      data: Partial<{ positionX: number; positionY: number; title: string | null; modelId: string; reasoningEffort: string; prompt: string; tabs: unknown[] }>,
      opts?: ApiClientOptions
    ) => request<{ block: unknown }>(`/blocks/${encodeURIComponent(blockId)}`, { method: "PATCH", body: JSON.stringify(data) }, opts),
    remove: (blockId: string, opts?: ApiClientOptions) => request<{ ok: true }>(`/blocks/${encodeURIComponent(blockId)}`, { method: "DELETE" }, opts),
    track: (blockId: string, data: { type: string; metadata?: unknown }, opts?: ApiClientOptions) =>
      request<{ ok: true }>(`/blocks/${encodeURIComponent(blockId)}/track`, { method: "POST", body: JSON.stringify(data) }, opts),
    writeNote: (blockId: string, data: { instruction: string; currentContent?: string }, opts?: ApiClientOptions) =>
      request<{ text: string }>(`/blocks/${encodeURIComponent(blockId)}/write-note`, { method: "POST", body: JSON.stringify(data) }, opts),
    explainStep: (
      blockId: string,
      data: { claim: string; detail?: string; reason?: string; otherSteps?: string[] },
      opts?: ApiClientOptions
    ) => request<{ text: string }>(`/blocks/${encodeURIComponent(blockId)}/explain-step`, { method: "POST", body: JSON.stringify(data) }, opts),
    redraw: (blockId: string, opts?: ApiClientOptions) =>
      request<{ block: unknown }>(`/blocks/${encodeURIComponent(blockId)}/redraw`, { method: "POST" }, opts),
    transcribe: (blockId: string, audioDataUrl: string, opts?: ApiClientOptions) =>
      request<{ transcript: string }>(`/blocks/${encodeURIComponent(blockId)}/transcribe`, { method: "POST", body: JSON.stringify({ audioDataUrl }) }, opts),
    /** Returns the raw PDF `Response` — caller reads `res.blob()`/`res.arrayBuffer()` itself,
     * same as this app's pre-split `ExportButton.tsx` fetch call did. */
    exportPdf: (blockId: string, diagramImageDataUrl?: string, opts?: ApiClientOptions) =>
      rawRequest(`/blocks/${encodeURIComponent(blockId)}/export-pdf`, { method: "POST", body: JSON.stringify({ diagramImageDataUrl }) }, opts),
  },
  usage: {
    budget: (opts?: ApiClientOptions) => request<{ budget: unknown }>("/usage/budget", {}, opts),
    canvas: (canvasId: string, opts?: ApiClientOptions) =>
      request<{ stats: unknown }>(`/canvases/${encodeURIComponent(canvasId)}/usage`, {}, opts),
    stats: (opts?: ApiClientOptions) => request<{ stats: unknown }>("/usage/stats", {}, opts),
  },
  insights: {
    get: (opts?: ApiClientOptions) => request<{ stats: unknown }>("/insights", {}, opts),
  },
  user: {
    get: (opts?: ApiClientOptions) => request<{ user: unknown }>("/user", {}, opts),
    update: (
      data: Partial<{
        displayName: string;
        defaultModelId: string;
        imageModelId: string;
        fileModelId: string;
        drawingModelId: string;
        fontSize: string;
        fontFamily: string;
        personalization: unknown;
      }>,
      opts?: ApiClientOptions
    ) => request<{ user: unknown }>("/user", { method: "PATCH", body: JSON.stringify(data) }, opts),
  },
  narrate: {
    /** Streams NDJSON `{type:"clip"|"done", ...}` lines — read `res.body` yourself, same shape
     * the pre-split `narrationStore.ts` already parses. */
    stream: (blockId: string, opts?: ApiClientOptions) =>
      rawRequest(`/blocks/${encodeURIComponent(blockId)}/narrate`, { method: "POST" }, opts),
  },
  messages: {
    /** Streams NDJSON generation events (`start`/`delta`/`reset`/`status`/`done`/`error`) — read
     * `res.body` yourself, same shape the pre-split `streamMessages.ts` already parses. */
    stream: (
      blockId: string,
      data: { content: string; attachments?: unknown[]; casual?: boolean; webSearch?: boolean; skillId?: string; requestId?: string },
      opts?: ApiClientOptions
    ) => rawRequest(`/blocks/${encodeURIComponent(blockId)}/messages`, { method: "POST", body: JSON.stringify(data) }, opts),
  },
  auth: {
    login: (email: string, password: string, totpCode?: string, opts?: ApiClientOptions) =>
      request<{ ok: true; user: { id: string; email: string | null; name: string | null } }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password, totpCode }) },
        opts
      ),
    logout: (opts?: ApiClientOptions) => request<{ ok: true }>("/auth/logout", { method: "POST" }, opts),
    signup: (data: { displayName: string; email: string; password: string }, opts?: ApiClientOptions) =>
      request<{ ok: true; accountCreated: boolean; devVerifyUrl?: string }>("/auth/signup", { method: "POST", body: JSON.stringify(data) }, opts),
    forgotPassword: (email: string, opts?: ApiClientOptions) =>
      request<{ ok: true; devResetUrl?: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }, opts),
    checkResetToken: (token: string, opts?: ApiClientOptions) =>
      request<{ valid: boolean }>(`/auth/reset-password?token=${encodeURIComponent(token)}`, {}, opts),
    resetPassword: (data: { token: string; newPassword: string }, opts?: ApiClientOptions) =>
      request<{ ok: true }>("/auth/reset-password", { method: "POST", body: JSON.stringify(data) }, opts),
    mfaCheck: (email: string, opts?: ApiClientOptions) =>
      request<{ mfaRequired: boolean }>("/auth/mfa-check", { method: "POST", body: JSON.stringify({ email }) }, opts),
  },
  userSecurity: {
    changePassword: (data: { currentPassword: string; newPassword: string }, opts?: ApiClientOptions) =>
      request<{ ok: true }>("/user/password", { method: "POST", body: JSON.stringify(data) }, opts),
    signOutAllDevices: (opts?: ApiClientOptions) => request<{ ok: true }>("/user/sessions", { method: "DELETE" }, opts),
    mfaSetup: (opts?: ApiClientOptions) =>
      request<{ secret: string; otpauthUrl: string }>("/user/mfa/setup", { method: "POST" }, opts),
    mfaEnable: (code: string, opts?: ApiClientOptions) =>
      request<{ ok: true; backupCodes: string[] }>("/user/mfa/enable", { method: "POST", body: JSON.stringify({ code }) }, opts),
    mfaDisable: (password: string, opts?: ApiClientOptions) =>
      request<{ ok: true }>("/user/mfa/disable", { method: "POST", body: JSON.stringify({ password }) }, opts),
  },
};
