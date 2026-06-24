import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { getWorkspaceDetail } from "@/app/actions/workspace";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceAvatar } from "@/components/workspace-avatar";
import { WorkspaceMobileNav } from "@/components/workspace-mobile-nav";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const workspace = await getWorkspaceDetail(id);

  if (!workspace) notFound();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border/40 bg-card/50 backdrop-blur-sm">
        {/* Workspace header */}
        <div className="flex items-center gap-2.5 border-b border-border/40 p-4">
          <WorkspaceAvatar name={workspace.name} iconColor={workspace.iconColor} size="sm" />
          <div className="min-w-0">
            <p className="font-heading font-semibold text-sm truncate">{workspace.name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{workspace.currentUserRole}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2">
          <Link
            href={`/workspace/${id}`}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LayoutDashboard className="h-4 w-4" />
            Boards
          </Link>
          <Link
            href={`/workspace/${id}/settings`}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings & Members
          </Link>
        </nav>

        {/* Footer */}
        <div className="border-t border-border/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              All workspaces
            </Link>
            <ThemeToggle />
          </div>
          <form action={signOut} className="w-full">
            <button
              type="submit"
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        <WorkspaceMobileNav
          workspaceId={id}
          workspaceName={workspace.name}
          workspaceIconColor={workspace.iconColor}
        />
        {children}
      </div>
    </div>
  );
}
