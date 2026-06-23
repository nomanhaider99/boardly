import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getWorkspaceDetail } from "@/app/actions/workspace";
import { getBoards } from "@/app/actions/board";
import { CreateBoardDialog } from "@/components/create-board-dialog";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const [workspace, boardList] = await Promise.all([
    getWorkspaceDetail(id),
    getBoards(id),
  ]);
  if (!workspace) notFound();

  return (
    <main className="flex-1 p-6 sm:p-8">
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold">{workspace.name}</h1>
          {workspace.description && (
            <p className="text-muted-foreground mt-1 text-sm">{workspace.description}</p>
          )}
        </div>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-primary" />
              Boards
            </h2>
            <CreateBoardDialog workspaceId={id} />
          </div>

          {boardList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-semibold mb-1">No boards yet</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-xs">
                Create your first board to start organising tasks into lists and cards.
              </p>
              <CreateBoardDialog workspaceId={id} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {boardList.map((board) => (
                <Link
                  key={board.id}
                  href={`/workspace/${id}/board/${board.id}`}
                  className="group flex flex-col justify-between rounded-xl border border-border/50 bg-card p-4 min-h-[90px] transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
                >
                  <p className="font-heading font-semibold group-hover:text-primary transition-colors">
                    {board.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(board.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
