"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { api, ApiError } from "@openmaths/api-client";

const SignupSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(80),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function SignupForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [neutralNotice, setNeutralNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<z.infer<typeof SignupSchema>>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof SignupSchema>) {
    setFormError(null);
    setNeutralNotice(null);
    setSubmitting(true);
    try {
      const body = await api.auth.signup(values);
      // PRD "Auth & Security Audit" F4 — the server responds identically whether this email was
      // free or already registered (so a prober can't enumerate accounts); `accountCreated`
      // distinguishes the two cases client-side only, for the person who's actually submitting.
      if (!body.accountCreated) {
        setNeutralNotice("If that email doesn't already have an account, check your inbox to verify it and finish signing up.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Ada Lovelace" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" placeholder="At least 8 characters" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        {neutralNotice && <p className="text-sm text-muted-foreground">{neutralNotice}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Form>
  );
}
