import { redirect } from "next/navigation";
import { get2FAPendingSession } from "@/lib/auth";
import { TwoFAForm } from "@/components/two-fa-form";

export const metadata = { title: "Two-Factor Authentication — Boardly" };

export default async function TwoFAPage() {
  const pending = await get2FAPendingSession();
  if (!pending) redirect("/sign-in");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Two-factor authentication</h1>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
        <TwoFAForm />
      </div>
    </div>
  );
}
