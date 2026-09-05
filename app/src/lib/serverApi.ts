import { cookies } from "next/headers";
import type { ApiClientOptions } from "@openmaths/api-client";

/**
 * PRD "Split into app + server" P3-continued — the `serverApi()` helper §5.3 names: Server
 * Components have no browser cookie jar of their own, so the incoming request's session cookie
 * has to be read via `next/headers` and forwarded explicitly on every server-to-server call to
 * `server`. `packages/api-client` stays framework-agnostic (no `next/headers` import there) —
 * this is the one place that bridges the two.
 */
export async function serverApiOptions(): Promise<ApiClientOptions> {
  const cookieStore = await cookies();
  return { cookie: cookieStore.toString() };
}
