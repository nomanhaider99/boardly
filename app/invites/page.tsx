import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getMyInvites } from "@/app/actions/invite";
import { Navbar } from "@/components/navbar";
import { WorkspaceAvatar } from "@/components/workspace-avatar";
import { InviteResponseButtons } from "@/components/invite-response-buttons";

export default async function InvitesPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const invites = await getMyInvites();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold">Invites</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Workspaces you&apos;ve been invited to join
          </p>
        </div>

        {invites.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <Mail className="h-6 w-6" />
            </div>
            <h3 className="font-heading font-semibold mb-1">No pending invites</h3>
            <p className="text-muted-foreground text-sm">
              When someone invites you to a workspace, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-4"
              >
                <WorkspaceAvatar
                  name={invite.workspaceName}
                  iconColor={invite.workspaceIconColor}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold truncate">
                    {invite.workspaceName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Invited by {invite.inviterFirstName} {invite.inviterLastName}
                    {" · "}
                    Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <InviteResponseButtons inviteId={invite.id} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
