import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

// Plain temp landing page (user ask) — no design pass yet, just the two entry points. Redirects
// straight to /dashboard when already signed in, same as "/" always used to unconditionally do;
// the difference now is a logged-out visitor actually sees this instead of bouncing off /login
// (see proxy.ts — "/" is a public route now, this page does its own auth branching instead of
// relying on the middleware's generic isAuthed-on-a-public-route redirect, which would otherwise
// try to redirect "/" to itself).
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">openmaths</h1>
        <p className="text-sm text-muted-foreground">AI-drawn, step-by-step math canvas.</p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/signup">Sign up</Link>
        </Button>
      </div>
    </div>
  );
}
