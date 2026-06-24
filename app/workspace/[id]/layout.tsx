import { notFound, redirect } from "next/navigation";
import { getWorkspaceDetail } from "@/app/actions/workspace";
import { getSession } from "@/lib/auth";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
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
      <WorkspaceSidebar
        workspaceId={id}
        workspaceName={workspace.name}
        workspaceIconColor={workspace.iconColor}
        workspaceRole={workspace.currentUserRole}
      />

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
