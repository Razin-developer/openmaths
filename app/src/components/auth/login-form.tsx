"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@openmaths/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const LoginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  totpCode: z.string().optional(),
});

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // PRD "Auth & Security Audit" F13 — MFA step-up. Only known once the pre-check below runs, so
  // the code field starts hidden and the form takes two submits for an MFA-enabled account: the
  // first reveals the field (no signIn attempted yet), the second actually authenticates.
  const [mfaRequired, setMfaRequired] = useState(false);

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "", totpCode: "" },
  });

  async function onSubmit(values: z.infer<typeof LoginSchema>) {
    setFormError(null);

    if (!mfaRequired) {
      const needsMfa = await api.auth
        .mfaCheck(values.email)
        .then((data) => !!data?.mfaRequired)
        .catch(() => false);
      if (needsMfa) {
        setMfaRequired(true);
        return;
      }
    }

    setSubmitting(true);
    // PRD "Split into app + server" P2/P3 — Hono now issues the session (see server/src/routes/
    // auth.ts + lib/auth/session.ts) via the base-URL client; this replaces next-auth/react's
    // `signIn()`, which posted to NextAuth's own `/api/auth/callback/credentials`.
    try {
      await api.auth.login(values.email, values.password, values.totpCode);
    } catch {
      setSubmitting(false);
      setFormError(mfaRequired ? "Invalid email, password, or authenticator code." : "Invalid email or password.");
      return;
    }
    setSubmitting(false);
    router.push("/dashboard");
    router.refresh();
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link href="/forgot-password" className="text-xs text-muted-foreground underline underline-offset-4">
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input type="password" autoComplete="current-password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {mfaRequired && (
          <FormField
            control={form.control}
            name="totpCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authenticator code</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code, or a backup code"
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : mfaRequired ? "Verify & sign in" : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}
