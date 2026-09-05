"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { api } from "@openmaths/api-client";

const Schema = z.object({ email: z.email("Enter a valid email address") });

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  // Only ever populated outside production (see the route) — lets this flow be tested end to
  // end without an SMTP server, exactly like signup's email-verification link.
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof Schema>) {
    setSubmitting(true);
    try {
      const data = await api.auth.forgotPassword(values.email).catch(() => null);
      setDevResetUrl(data?.devResetUrl ?? null);
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, a reset link has been sent. It expires in 1 hour.
        </p>
        {devResetUrl && (
          <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              No email server is configured in this environment — here&rsquo;s the link directly:
            </p>
            <a href={devResetUrl} className="block truncate text-xs text-foreground underline underline-offset-4">
              {devResetUrl}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </Form>
  );
}
