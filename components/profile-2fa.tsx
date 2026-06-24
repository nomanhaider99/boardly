"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generate2FASetup, enable2FA, disable2FA } from "@/app/actions/profile";

type UIState = "idle" | "setup" | "backupCodes" | "disabling";

interface Props {
  twoFactorEnabled: boolean;
}

export function Profile2FA({ twoFactorEnabled: initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [uiState, setUIState] = useState<UIState>("idle");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [credential, setCredential] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true);
    const result = await generate2FASetup();
    setLoading(false);
    if (!result) {
      toast.error("Failed to generate setup. Please try again.");
      return;
    }
    setQrUrl(result.qrUrl);
    setSecret(result.secret);
    setCode("");
    setUIState("setup");
  }

  async function confirmEnable() {
    if (!secret) return;
    setLoading(true);
    const result = await enable2FA({ code, secret });
    setLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to enable 2FA.");
      return;
    }
    setBackupCodes(result.backupCodes ?? []);
    setEnabled(true);
    setUIState("backupCodes");
    router.refresh();
  }

  async function confirmDisable() {
    setLoading(true);
    const result = await disable2FA({ credential });
    setLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to disable 2FA.");
      return;
    }
    toast.success("Two-factor authentication disabled.");
    setEnabled(false);
    setCredential("");
    setUIState("idle");
    router.refresh();
  }

  async function copyBackupCodes() {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Backup codes display ──────────────────────────────────────────
  if (uiState === "backupCodes") {
    return (
      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">2FA Enabled — Save Your Backup Codes</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Store these codes somewhere safe. Each code can be used once to sign in if you lose access to your authenticator app. They{" "}
          <strong>won&apos;t be shown again.</strong>
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-4 font-mono text-sm">
          {backupCodes.map((c) => (
            <span key={c} className="tracking-widest">{c}</span>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={copyBackupCodes}>
            {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
            {copied ? "Copied!" : "Copy all"}
          </Button>
          <Button size="sm" onClick={() => setUIState("idle")}>
            Done
          </Button>
        </div>
      </section>
    );
  }

  // ── Disable confirmation ──────────────────────────────────────────
  if (uiState === "disabling") {
    return (
      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5 text-destructive" />
          <h2 className="text-base font-semibold">Disable Two-Factor Authentication</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter your current 6-digit authenticator code, a backup code, or your account password to confirm.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="disable-credential">Code or password</Label>
          <Input
            id="disable-credential"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="123456 / backup code / password"
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setCredential(""); setUIState("idle"); }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={loading || !credential}
            onClick={confirmDisable}
          >
            {loading ? "Disabling…" : "Disable 2FA"}
          </Button>
        </div>
      </section>
    );
  }

  // ── TOTP setup ────────────────────────────────────────────────────
  if (uiState === "setup") {
    return (
      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="text-base font-semibold">Set Up Two-Factor Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code it shows.
        </p>
        {qrUrl && (
          <div className="flex justify-center">
            <div className="rounded-lg border border-border bg-white p-2 inline-block">
              <Image src={qrUrl} alt="2FA QR Code" width={180} height={180} unoptimized />
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="totp-code">Verification code</Label>
          <Input
            id="totp-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            className="tracking-widest text-center text-lg"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setQrUrl(null); setSecret(null); setCode(""); setUIState("idle"); }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={loading || code.length !== 6}
            onClick={confirmEnable}
          >
            {loading ? "Verifying…" : "Enable 2FA"}
          </Button>
        </div>
      </section>
    );
  }

  // ── Idle state ────────────────────────────────────────────────────
  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${enabled ? "text-primary" : "text-muted-foreground"}`} />
            <h2 className="text-base font-semibold">Two-Factor Authentication</h2>
            {enabled && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Active
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? "Your account is protected with an authenticator app."
              : "Add an extra layer of security to your account."}
          </p>
        </div>
        {enabled ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUIState("disabling")}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
          >
            Disable
          </Button>
        ) : (
          <Button size="sm" disabled={loading} onClick={startSetup} className="shrink-0">
            {loading ? "Loading…" : "Enable 2FA"}
          </Button>
        )}
      </div>
    </section>
  );
}
