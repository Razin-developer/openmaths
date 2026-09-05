"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@openmaths/api-client";

type Step = "idle" | "setup" | "confirm" | "backup-codes";

/** MFA (PRD "Auth & Security Audit" F13). No QR-code image — this environment has no
 * image-generation dependency available offline — so setup shows the otpauth:// URI as copyable
 * text plus the raw secret for manual entry; every authenticator app accepts either. */
export function MfaSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>("idle");
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setBusy(true);
    try {
      const data = await api.userSecurity.mfaSetup();
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setStep("confirm");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't start MFA setup");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    setBusy(true);
    try {
      const data = await api.userSecurity.mfaEnable(code);
      setBackupCodes(data.backupCodes);
      setEnabled(true);
      setStep("backup-codes");
      setCode("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't verify that code");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await api.userSecurity.mfaDisable(password);
      setEnabled(false);
      setStep("idle");
      setPassword("");
      toast.success("Two-factor authentication disabled");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't disable MFA");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Two-factor authentication</p>
        <span className={`text-[11px] ${enabled ? "text-foreground" : "text-muted-foreground"}`}>
          {enabled ? "Enabled" : "Not enabled"}
        </span>
      </div>

      {step === "idle" && !enabled && (
        <Button size="sm" variant="outline" onClick={startSetup} disabled={busy} className="text-xs">
          Set up two-factor authentication
        </Button>
      )}

      {step === "confirm" && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-[11px] text-muted-foreground">
            Scan this in your authenticator app (Google Authenticator, Authy, 1Password, …), or enter the secret manually.
          </p>
          <div className="space-y-1">
            <Label className="text-[10.5px] text-muted-foreground">Setup link</Label>
            <p className="break-all rounded bg-muted px-2 py-1 font-mono text-[10.5px]">{otpauthUrl}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10.5px] text-muted-foreground">Manual entry secret</Label>
            <p className="break-all rounded bg-muted px-2 py-1 font-mono text-[10.5px]">{secret}</p>
          </div>
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="mfa-code" className="text-xs">Enter the 6-digit code from your app</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="h-8 text-xs"
            />
          </div>
          <Button size="sm" onClick={confirmSetup} disabled={busy || code.length < 6} className="text-xs">
            Verify & enable
          </Button>
        </div>
      )}

      {step === "backup-codes" && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-[11px] font-medium">Save these backup codes now — they won&rsquo;t be shown again.</p>
          <p className="text-[11px] text-muted-foreground">Each works once, if you lose access to your authenticator app.</p>
          <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
            {backupCodes.map((c) => (
              <span key={c} className="rounded bg-muted px-2 py-1">{c}</span>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setStep("idle")} className="text-xs">
            Done
          </Button>
        </div>
      )}

      {enabled && step === "idle" && (
        <div className="space-y-1.5">
          <Label htmlFor="mfa-disable-password" className="text-xs">Enter your password to disable two-factor authentication</Label>
          <div className="flex gap-2">
            <Input
              id="mfa-disable-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 text-xs"
            />
            <Button size="sm" variant="destructive" onClick={disable} disabled={busy || !password} className="text-xs">
              Disable
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
