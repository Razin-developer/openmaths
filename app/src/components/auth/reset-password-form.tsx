"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { api, ApiError } from "@openmaths/api-client";

const Schema = z.object({ newPassword: z.string().min(8, "At least 8 characters") });

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: { newPassword: "" },
  });

  useEffect(() => {
    // Peek-only GET so loading the page doesn't itself burn the one-time token.
    api.auth
      .checkResetToken(token)
      .then((data) => setValid(!!data?.valid))
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  async function onSubmit(values: z.infer<typeof Schema>) {
    setFormError(null);
    setSubmitting(true);
    try {
      await api.auth.resetPassword({ token, newPassword: values.newPassword });
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't reset your password");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return <p className="text-sm text-muted-foreground">Checking link…</p>;

  if (!valid) {
    return (
      <p className="text-sm text-destructive">
        This reset link is invalid or has expired — request a new one from the sign-in page.
      </p>
    );
  }

  if (done) {
    return <p className="text-sm text-muted-foreground">Password changed. Redirecting to sign in…</p>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" placeholder="At least 8 characters" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </Form>
  );
}
