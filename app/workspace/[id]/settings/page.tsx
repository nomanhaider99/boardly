import { notFound, redirect } from "next/navigation";
import { Users, Crown, UserIcon } from "lucide-react";
import { getWorkspaceDetail } from "@/app/actions/workspace";
import { getWorkspaceSentInvites } from "@/app/actions/invite";
import { getSession } from "@/lib/auth";
import { InviteForm } from "@/components/invite-form";

function MemberAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-heading font-bold text-sm">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const [workspace, pendingInvites] = await Promise.all([
    getWorkspaceDetail(id),
    getWorkspaceSentInvites(id),
  ]);

  if (!workspace) notFound();

  return (
    <main className="flex-1 p-6 sm:p-8 max-w-2xl space-y-10">
      <h1 className="font-heading text-2xl font-bold">Settings &amp; Members</h1>

      {/* Workspace info */}
      <section>
        <h2 className="font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-3">
          Workspace
        </h2>
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-1.5">
          <p className="font-heading font-semibold text-lg">{workspace.name}</p>
          {workspace.description && (
            <p className="text-muted-foreground text-sm">{workspace.description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Created{" "}
            {new Date(workspace.createdAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </section>

      {/* Invite */}
      <section>
        <h2 className="font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-3">
          Invite by email
        </h2>
        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <InviteForm workspaceId={id} pendingInvites={pendingInvites} />
        </div>
      </section>

      {/* Members */}
      <section>
        <h2 className="font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          Members ({workspace.members.length})
        </h2>

        <div className="rounded-2xl border border-border/50 bg-card divide-y divide-border/40 overflow-hidden">
          {workspace.members.map((member) => (
            <div key={member.userId} className="flex items-center gap-3 px-4 py-3">
              <MemberAvatar name={member.firstName} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {member.firstName} {member.lastName}
                  {member.userId === session.userId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {member.role === "owner" ? (
                  <Crown className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-xs font-medium capitalize text-muted-foreground">
                  {member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
