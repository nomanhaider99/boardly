import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getUserWorkspaces } from "@/app/actions/workspace";
import { Navbar } from "@/components/navbar";
import { WorkspaceAvatar } from "@/components/workspace-avatar";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { WorkspaceGridSkeleton } from "@/components/workspace-card-skeleton";

async function WorkspaceGrid() {
  const workspaceList = await getUserWorkspaces();

  if (workspaceList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
          <LayoutDashboard className="h-7 w-7" />
        </div>
        <h3 className="font-heading font-semibold text-lg mb-1">No workspaces yet</h3>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs">
          Create your first workspace to start organising projects with your team.
        </p>
        <CreateWorkspaceDialog />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workspaceList.map((ws) => (
        <Link
          key={ws.id}
          href={`/workspace/${ws.id}`}
          className="group rounded-2xl border border-border/50 bg-card p-5 space-y-3 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
        >
          <div className="flex items-center gap-3">
            <WorkspaceAvatar name={ws.name} iconColor={ws.iconColor} />
            <div className="min-w-0">
              <p className="font-heading font-semibold truncate">{ws.name}</p>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-primary/10 text-primary">
                {ws.role}
              </span>
            </div>
          </div>
          {ws.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {ws.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
            Open workspace →
          </p>
        </Link>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-2xl font-bold">My Workspaces</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              All the workspaces you belong to
            </p>
          </div>
          <CreateWorkspaceDialog />
        </div>

        <Suspense fallback={<WorkspaceGridSkeleton />}>
          <WorkspaceGrid />
        </Suspense>
      </main>
    </div>
  );
}
