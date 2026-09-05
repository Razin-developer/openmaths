"use client";

import { useState } from "react";
import { Share2, Mail, Link2, Copy, Check, X, Gauge } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@openmaths/api-client";

type Role = "EDITOR" | "COMMENTER" | "VIEWER";

interface Collaborator {
  id: string;
  email: string;
  role: Role;
  status: "PENDING" | "ACTIVE";
}

interface ShareLink {
  token: string;
  role: Role;
  expiresAt: string | null;
}

interface CanvasActorUsage {
  userId: string;
  displayName: string | null;
  email: string | null;
  requests: number;
  costUsd: number;
  anyEstimated: boolean;
  anyUnknownCost: boolean;
}

interface CanvasUsageStats {
  totalRequests: number;
  totalCostUsd: number;
  anyEstimated: boolean;
  anyUnknownCost: boolean;
  byActor: CanvasActorUsage[];
}

const ROLE_LABEL: Record<Role, string> = { EDITOR: "Editor", COMMENTER: "Commenter", VIEWER: "Viewer" };
const EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: "off", label: "No expiry" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

function RolePicker({ value, onChange, disabled }: { value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Role)} disabled={disabled}>
      <SelectTrigger size="sm" className="h-7 w-24 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {(["EDITOR", "COMMENTER", "VIEWER"] as Role[]).map((r) => (
          <SelectItem key={r} value={r} className="text-xs">
            {ROLE_LABEL[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ShareDropdown({ canvasId }: { canvasId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [usage, setUsage] = useState<CanvasUsageStats | null>(null);

  // PRD "Split into app + server" P3-continued round 4/5 — cut over to the base-URL client.
  async function loadShareState() {
    if (loaded) return;
    try {
      const data = await api.sharing.get(canvasId);
      setCollaborators((data.collaborators as Collaborator[]) ?? []);
      setShareLink((data.shareLink as ShareLink | null) ?? null);
    } catch {
      // Same tolerant behavior as before — a failed load just leaves the dialog empty.
    }
    try {
      const { stats } = await api.usage.canvas(canvasId);
      setUsage((stats as CanvasUsageStats) ?? null);
    } catch {
      // Same tolerant behavior as before.
    }
    setLoaded(true);
  }

  async function handleInvite() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter an email address to invite");
      return;
    }
    setInviting(true);
    try {
      const { collaborator } = await api.sharing.invite(canvasId, { email: trimmed, role: inviteRole });
      const c = collaborator as Collaborator;
      setCollaborators((prev) => {
        const next = prev.filter((x) => x.id !== c.id);
        return [...next, c];
      });
      setEmail("");
      toast.success(`${trimmed} can now access this canvas as ${ROLE_LABEL[inviteRole]}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't add that collaborator");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(collaboratorId: string, role: Role) {
    setCollaborators((prev) => prev.map((c) => (c.id === collaboratorId ? { ...c, role } : c)));
    await api.sharing.updateRole(canvasId, collaboratorId, role).catch(() => {
      toast.error("Couldn't update that person's access");
    });
  }

  async function handleRemoveCollaborator(id: string) {
    setCollaborators((prev) => prev.filter((c) => c.id !== id));
    await api.sharing.removeCollaborator(canvasId, id).catch(() => {});
  }

  async function handleGenerateLink(role: Role = shareLink?.role ?? "VIEWER", expiry = "off") {
    try {
      const { shareLink: next } = await api.sharing.generateLink(canvasId, { role, expiry });
      setShareLink(next as ShareLink);
    } catch {
      toast.error("Couldn't create a share link");
    }
  }

  async function handleRevokeLink() {
    setShareLink(null);
    await api.sharing.revokeLink(canvasId).catch(() => {});
    toast.success("Share link revoked");
  }

  async function handleCopyLink() {
    if (!shareLink) return;
    const url = `${window.location.origin}/canvas/${canvasId}?share=${shareLink.token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Share link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      {/* A one-item dropdown that just opens this dialog was a redundant extra click (§8) —
          open it directly from the button. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label="Share"
        onClick={() => {
          setDialogOpen(true);
          loadShareState();
        }}
      >
        <Share2 className="size-4" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Share this canvas</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Mail className="size-3" /> Invite by email
              </p>
              <div className="flex items-center gap-1.5">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="name@example.com"
                  type="email"
                  className="h-8 flex-1 text-xs"
                />
                <RolePicker value={inviteRole} onChange={setInviteRole} />
              </div>
              <Button size="sm" className="mt-1.5 h-8 w-full text-xs" onClick={handleInvite} disabled={inviting}>
                Invite
              </Button>
              {collaborators.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {collaborators.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1 text-[11px]">
                      <span className="min-w-0 flex-1 truncate">
                        {c.email}
                        {c.status === "PENDING" && <span className="ml-1 text-muted-foreground">(pending)</span>}
                      </span>
                      <RolePicker value={c.role} onChange={(role) => handleRoleChange(c.id, role)} />
                      <button
                        onClick={() => handleRemoveCollaborator(c.id)}
                        aria-label={`Remove ${c.email}`}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border pt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Link2 className="size-3" /> Share link
              </p>
              {shareLink ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <RolePicker value={shareLink.role} onChange={(role) => handleGenerateLink(role, "off")} />
                    <Select
                      value={shareLink.expiresAt ? "custom" : "off"}
                      onValueChange={(v) => handleGenerateLink(shareLink.role, v)}
                    >
                      <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                        <SelectValue placeholder="Expiry" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        {EXPIRY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {shareLink.expiresAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Expires {new Date(shareLink.expiresAt).toLocaleString()}
                    </p>
                  )}
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 flex-1 gap-1.5 text-xs" onClick={handleCopyLink}>
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      Copy link
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={handleRevokeLink}>
                      Revoke
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-8 w-full text-xs" onClick={() => handleGenerateLink()}>
                  Generate share link
                </Button>
              )}
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Anyone with this link gets access at the role above — least privilege by default
                (Viewer); no link means restricted to invited people only.
              </p>
            </div>

            {usage && usage.totalRequests > 0 && (
              <div className="border-t border-border pt-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Gauge className="size-3" /> AI cost on this canvas
                </p>
                <p className="text-xs font-medium">
                  ${usage.totalCostUsd.toFixed(2)}
                  {(usage.anyEstimated || usage.anyUnknownCost) && (
                    <span className="ml-1 font-normal text-muted-foreground">(floor — some costs estimated/unknown)</span>
                  )}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {usage.byActor.map((a) => (
                    <li key={a.userId} className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="min-w-0 flex-1 truncate">{a.displayName ?? a.email ?? a.userId}</span>
                      <span className="shrink-0 tabular-nums">
                        ${a.costUsd.toFixed(2)} · {a.requests} req
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
