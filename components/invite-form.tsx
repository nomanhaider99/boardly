"use client";

import { useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { sendInvite, revokeInvite } from "@/app/actions/invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SentInvite } from "@/app/actions/invite";

export function InviteForm({
  workspaceId,
  pendingInvites,
}: {
  workspaceId: string;
  pendingInvites: SentInvite[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleRevoke(inv: SentInvite) {
    if (!window.confirm(`Revoke the pending invite to ${inv.invitedEmail}? The invite link will stop working.`)) {
      return;
    }
    setRevokingId(inv.id);
    const result = await revokeInvite(inv.id);
    setRevokingId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Invite revoked.");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData();
    fd.append("email", email);
    const result = await sendInvite(workspaceId, fd);
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Invite sent!");
    setEmail("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="invite-email" className="sr-only">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={loading || !email.trim()} className="gap-2 shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Invite
        </Button>
      </form>

      {pendingInvites.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Pending invites
          </p>
          <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-3 py-2.5"
              >
                <div>
                  <p className="text-sm">{inv.invitedEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-500">
                    Pending
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv)}
                    disabled={revokingId === inv.id}
                    aria-label={`Revoke invite to ${inv.invitedEmail}`}
                    title="Revoke invite"
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    {revokingId === inv.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
