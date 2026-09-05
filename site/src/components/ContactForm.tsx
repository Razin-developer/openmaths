"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "./Button";
import { submitContactForm, type ContactSubmissionType } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.email("Enter a valid email address"),
  message: z.string().trim().min(1, "Message is required").max(5000),
  website: z.string().max(0).optional(),
});

type FormValues = z.infer<typeof schema>;

interface ContactFormProps {
  type: ContactSubmissionType;
  messageLabel?: string;
  messagePlaceholder?: string;
}

/** Backs /contact, /feedback, and /report-bug (PRD §5.3) — same shape, different `type` and
 * copy. The `website` field is a honeypot: visually hidden via `sr-only`-style absolute
 * positioning (not `display:none`, which some bots skip when deciding what to fill in) and never
 * shown to a real visitor. */
export function ContactForm({ type, messageLabel = "Message", messagePlaceholder }: ContactFormProps) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", message: "", website: "" } });

  async function onSubmit(values: FormValues) {
    setStatus("idle");
    try {
      await submitContactForm({ type, ...values });
      setStatus("success");
      reset();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="mx-auto max-w-[480px] rounded-xl border border-border bg-muted/40 p-8 text-center">
        <p className="text-body font-medium">Thanks — we&rsquo;ve got it.</p>
        <p className="mt-2 text-body-sm text-muted-foreground">We read every submission, though we can&rsquo;t promise a reply to each one.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto flex max-w-[480px] flex-col gap-4">
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
        Name
        <input
          {...register("name")}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground"
        />
        {errors.name && (
          <span id="name-error" role="alert" className="text-caption text-danger">
            {errors.name.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
        Email
        <input
          type="email"
          {...register("email")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground"
        />
        {errors.email && (
          <span id="email-error" role="alert" className="text-caption text-danger">
            {errors.email.message}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-2 text-body-sm text-muted-foreground">
        {messageLabel}
        <textarea
          {...register("message")}
          rows={5}
          placeholder={messagePlaceholder}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          className="rounded-md border border-border bg-background px-3 py-2 text-body text-foreground"
        />
        {errors.message && (
          <span id="message-error" role="alert" className="text-caption text-danger">
            {errors.message.message}
          </span>
        )}
      </label>

      {status === "error" && (
        <p role="alert" className="text-body-sm text-danger">
          {errorMessage}
        </p>
      )}

      <Button type="submit" variant="primary" className="mt-2">
        {isSubmitting ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
