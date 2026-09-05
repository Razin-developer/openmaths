import { createMiddleware } from "hono/factory";
import type { prisma } from "@openmaths/db";
import { getCurrentUser, UnauthorizedError } from "../lib/currentUser";

type User = Awaited<ReturnType<typeof prisma.user.findUnique>> & object;

/**
 * Applied per-route (not globally with "*") so P1's still-anonymous routes (e.g. a future
 * public health/status page) aren't forced through this — matches `app`'s own per-route
 * `getCurrentUser()` calls rather than a blanket middleware.
 */
export const requireAuth = createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
  try {
    const user = await getCurrentUser(c.req.raw);
    c.set("user", user as User);
  } catch (err) {
    if (err instanceof UnauthorizedError) return c.json({ error: "Unauthorized" }, 401);
    throw err;
  }
  await next();
});
