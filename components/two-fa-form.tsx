"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verify2FALogin } from "@/app/actions/auth";

export function TwoFAForm() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [useBackup, setUseBackup] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    const result = await verify2FALogin(code);
    setLoading(false);
    if (result && !result.success) {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="2fa-code">
          {useBackup ? "Backup code" : "Authenticator code"}
        </Label>
        <Input
          id="2fa-code"
          value={code}
          onChange={(e) =>
            setCode(
              useBackup
                ? e.target.value.toUpperCase()
                : e.target.value.replace(/\D/g, "").slice(0, 6)
            )
          }
          placeholder={useBackup ? "XXXXXXXX" : "000000"}
          inputMode={useBackup ? "text" : "numeric"}
          maxLength={useBackup ? 8 : 6}
          className="text-center tracking-widest text-lg"
          autoFocus
          autoComplete="one-time-code"
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading || !code}>
        {loading ? "Verifying…" : "Continue"}
      </Button>

      <div className="text-center space-y-2">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          onClick={() => { setUseBackup(!useBackup); setCode(""); }}
        >
          {useBackup ? "Use authenticator code instead" : "Use a backup code"}
        </button>
        <div>
          <Link
            href="/sign-in"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </form>
  );
}
