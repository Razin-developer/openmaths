"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@openmaths/api-client";
import { Button } from "@/components/ui/button";

// PRD "Split into app + server" P2/P3 — Hono now clears the session (server/src/routes/auth.ts)
// via the base-URL client, replacing next-auth/react's `signOut()`.
export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await api.auth.logout().catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={handleSignOut}>
      <LogOut className="size-3.5" />
    </Button>
  );
}
