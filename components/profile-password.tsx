"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/app/actions/profile";

export function ProfilePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    const result = await changePassword({ currentPassword: current, newPassword: next });
    setSaving(false);
    if (result.success) {
      toast.success("Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } else {
      toast.error(result.error ?? "Failed to update password.");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-5">
      <h2 className="text-base font-semibold">Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="current-pass">Current password</Label>
          <Input
            id="current-pass"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-pass">New password</Label>
          <Input
            id="new-pass"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-pass">Confirm new password</Label>
          <Input
            id="confirm-pass"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !current || !next || !confirm} size="sm">
            {saving ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </section>
  );
}
