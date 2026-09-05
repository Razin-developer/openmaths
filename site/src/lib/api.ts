const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type ContactSubmissionType = "CONTACT" | "FEEDBACK" | "BUG_REPORT";

export interface ContactPayload {
  type: ContactSubmissionType;
  name: string;
  email: string;
  message: string;
  /** Honeypot — must stay empty; real form fields never set this. */
  website?: string;
}

/** Posts directly to `server`'s `POST /contact` (server/src/routes/contact.ts) — this is the one
 * place `site` talks to the backend at all (PRD §1: "its only backend touch is form
 * submissions"), so a small hand-rolled fetch is enough; there's no need for the full
 * `packages/api-client` this simple one-endpoint case doesn't otherwise use. */
export async function submitContactForm(payload: ContactPayload): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(res.status === 429 ? "Too many submissions — please try again later." : "Something went wrong. Please try again.");
  }
}
