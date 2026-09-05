import type { FAQItem } from "@/components/FAQAccordion";

export const FAQ_ITEMS: FAQItem[] = [
  {
    category: "Getting started",
    question: "Do I need to sign up to use openmaths?",
    answer: "The free math tools under /tools work without an account. Asking a question and getting a full step-by-step, narrated explanation needs a free account.",
  },
  {
    category: "Getting started",
    question: "What kinds of math questions can I ask?",
    answer: "Arithmetic, algebra, geometry, and graphing questions all work. Geometry and graphing questions are the ones most likely to get a drawn diagram alongside the explanation.",
  },
  {
    category: "Pricing",
    question: "Is there really a free tier?",
    answer: "Yes — unlimited canvases and every answer form, with lower monthly generation limits than Pro. See the pricing page for the full comparison.",
  },
  {
    category: "Pricing",
    question: "Can I cancel a Pro subscription anytime?",
    answer: "Yes, Pro is month-to-month with no lock-in contract.",
  },
  {
    category: "Accounts",
    question: "How do I reset my password?",
    answer: "Use the \"Forgot password?\" link on the login page — you'll get an email with a reset link.",
  },
  {
    category: "Accounts",
    question: "Can I enable two-factor authentication?",
    answer: "Yes — TOTP-based MFA can be enabled from Settings → Profile, using any standard authenticator app.",
  },
  {
    category: "Privacy",
    question: "Who can see the canvases I create?",
    answer: "Only you, unless you explicitly share a canvas with someone by email or share link. Nothing is public by default.",
  },
  {
    category: "Tools",
    question: "Are the free tools under /tools the same math as the full product?",
    answer: "Yes — the same underlying calculations, just without the step-by-step explanation, diagram, and narration the full product adds.",
  },
];
