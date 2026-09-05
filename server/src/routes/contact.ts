import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@openmaths/db";
import { checkRateLimit } from "@openmaths/db/auth/rateLimit";

/**
 * Backs the marketing site's /contact, /feedback, and /report-bug forms (PRD "Public Product
 * Site, Pages & Design/Motion System" P5, §5.3/§8: "contact/bug/feedback forms submit to the
 * Hono server with validation + anti-spam"). One route, one model (`ContactSubmission`), a `type`
 * field distinguishing intent — the three forms are the same shape (name, email, message), not
 * different data, so three separate routes/tables would just be duplication.
 *
 * No auth: these are anonymous-visitor forms by design, not something only logged-in users can
 * reach. Anti-spam is a honeypot field (`website` — real users never fill in a field named and
 * visually hidden as an unrelated one; bots filling every field in a form catch themselves) plus
 * IP rate limiting, matching the pattern every other public-write route in this file's siblings
 * (auth.ts's login/signup/forgot-password) already uses.
 */
const contactSchema = z.object({
  type: z.enum(["CONTACT", "FEEDBACK", "BUG_REPORT"]),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  message: z.string().trim().min(1).max(5000),
  // Honeypot — must arrive empty. Present in the schema (not silently dropped) so a filled-in
  // value fails validation with a generic 400 rather than a tell-tale "spam detected" response
  // that would help a bot operator iterate against this exact check.
  website: z.string().max(0).optional().default(""),
});

export const contactRoutes = new Hono();

contactRoutes.post("/contact", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await checkRateLimit(`contact:${ip}`, 5, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    return c.json({ error: "Too many submissions. Please try again later." }, 429);
  }

  const parsed = contactSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid submission." }, 400);
  }
  const { type, name, email, message } = parsed.data;

  await prisma.contactSubmission.create({ data: { type, name, email, message } });

  return c.json({ ok: true }, 201);
});
