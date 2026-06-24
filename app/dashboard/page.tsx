import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { LayoutDashboard } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getUserWorkspaces } from "@/app/actions/workspace";
import { Navbar } from "@/components/navbar";
import { WorkspaceAvatar } from "@/components/workspace-avatar";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { WorkspaceGridSkeleton } from "@/components/workspace-card-skeleton";

async function WorkspaceGrid() {
  const workspaceList = await getUserWorkspaces();

  if (workspaceList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
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
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {workspaceList.map((ws) => (
        <Link
          key={ws.id}
          href={`/workspace/${ws.id}`}
          className="group rounded-2xl border border-border/50 bg-card overflow-hidden transition-all duration-200 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/8 hover:-translate-y-1"
        >
          {/* Coloured gradient header */}
          <div
            className="relative h-28 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${ws.iconColor}55 0%, ${ws.iconColor}20 100%)`,
            }}
          >
            <WorkspaceAvatar name={ws.name} iconColor={ws.iconColor} size="lg" />
          </div>

          {/* Card body */}
          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-heading font-semibold text-base leading-tight truncate">
                {ws.name}
              </p>
              <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary">
                {ws.role}
              </span>
            </div>

            {ws.description ? (
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {ws.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/40 italic">No description</p>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-[11px] text-muted-foreground">
                Created{" "}
                {new Date(ws.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-xs font-semibold text-primary translate-x-0 group-hover:translate-x-0.5 transition-transform">
                Open →
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [user] = await db
    .select({ firstName: users.firstName })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Hero banner */}
      <div className="border-b border-border/40 bg-gradient-to-br from-primary/8 via-background to-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">
                Welcome back{user ? `, ${user.firstName}` : ""}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Here are all the workspaces you belong to
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h2 className="font-heading text-lg font-semibold">Workspaces</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click a workspace to open its boards
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
