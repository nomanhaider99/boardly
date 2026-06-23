import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyEmail } from "@/app/actions/auth";
import { buttonVariants } from "@/components/ui/button";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <VerifyResult success={false} error="No verification token provided." />;
  }

  const result = await verifyEmail(token);

  return <VerifyResult success={result.success} error={!result.success ? result.error : undefined} />;
}

function VerifyResult({
  success,
  error,
}: {
  success: boolean;
  error?: string;
}) {
  return (
    <div className="text-center space-y-4">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
          success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
        }`}
      >
        {success ? (
          <CheckCircle2 className="h-8 w-8" />
        ) : (
          <XCircle className="h-8 w-8" />
        )}
      </div>

      <h2 className="font-heading text-2xl font-bold">
        {success ? "Email verified!" : "Verification failed"}
      </h2>

      <p className="text-muted-foreground">
        {success
          ? "Your email has been verified. You can now sign in."
          : error}
      </p>

      <Link href="/sign-in" className={buttonVariants({ className: "w-full" })}>
        {success ? "Go to sign in" : "Back to sign in"}
      </Link>
    </div>
  );
}
