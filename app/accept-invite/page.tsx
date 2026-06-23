import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, LogIn } from "lucide-react";
import { getSession } from "@/lib/auth";
import { acceptInviteByToken } from "@/app/actions/invite";
import { buttonVariants } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <Result type="error" message="No invite token provided." />;
  }

  const session = await getSession();

  // Not signed in — bounce to sign-in with return URL
  if (!session) {
    redirect(`/sign-in?from=/accept-invite?token=${token}`);
  }

  const result = await acceptInviteByToken(token);

  if (result.success) {
    redirect(`/workspace/${result.workspaceId}?joined=1`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center p-8">
        <Result type="error" message={result.error} />
      </main>
    </div>
  );
}

function Result({ type, message }: { type: "error"; message: string }) {
  return (
    <div className="text-center space-y-4 max-w-sm mx-auto">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <XCircle className="h-8 w-8" />
      </div>
      <h2 className="font-heading text-2xl font-bold">Invite failed</h2>
      <p className="text-muted-foreground">{message}</p>
      <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
        Go to dashboard
      </Link>
    </div>
  );
}
