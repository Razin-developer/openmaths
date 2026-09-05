"use client";

import { useState } from "react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/settings/UserAvatar";
import { MfaSettings } from "@/components/settings/MfaSettings";
import { api, ApiError } from "@openmaths/api-client";

export function ProfileSettings({
  initialDisplayName,
  email,
  userId,
  hasPassword,
  mfaEnabled,
}: {
  initialDisplayName: string | null;
  email: string | null;
  userId: string;
  hasPassword: boolean;
  mfaEnabled: boolean;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.user.update({ displayName });
      toast.success("Profile saved");
    } catch {
      toast.error("Couldn't save your profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await api.userSecurity.changePassword({ currentPassword, newPassword });
      // PRD "Auth & Security Audit" F8 — the server just invalidated every session for this
      // account, including this one, so this browser signs itself out rather than continuing on
      // a token that will fail its next revalidation anyway.
      toast.success("Password changed — signing you out for security.");
      await signOut({ redirectTo: "/login" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't change your password");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSignOutEverywhere() {
    setRevoking(true);
    try {
      await api.userSecurity.signOutAllDevices();
      toast.success("Signed out everywhere — signing out here too.");
      await signOut({ redirectTo: "/login" });
    } catch {
      toast.error("Couldn't sign out other devices");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserAvatar name={displayName || email} seed={userId} size={48} />
        <p className="text-[11px] text-muted-foreground">
          Your avatar is generated from your name — no upload needed.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="display-name" className="text-xs">
            Display name
          </Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-xs font-medium">Change password</p>
        {hasPassword && (
          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="text-xs">
              Current password
            </Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-xs">
            New password
          </Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="h-8 text-xs"
          />
        </div>
        <Button size="sm" variant="outline" onClick={handleChangePassword} disabled={changingPassword} className="text-xs">
          {changingPassword ? "Changing…" : "Change password"}
        </Button>
      </div>

      <MfaSettings initialEnabled={mfaEnabled} />

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-xs font-medium">Sessions</p>
        <p className="text-[11px] text-muted-foreground">
          Sign out of every device where you&rsquo;re currently signed in, including this one.
        </p>
        <Button size="sm" variant="outline" onClick={handleSignOutEverywhere} disabled={revoking} className="text-xs">
          {revoking ? "Signing out…" : "Sign out of all devices"}
        </Button>
      </div>
    </div>
  );
}
