import { notFound, redirect } from "next/navigation";
import { eq, asc, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getWorkspaceDetail } from "@/app/actions/workspace";
import { db } from "@/lib/db";
import { boards, lists, cards } from "@/db/schema";
import { BoardView, type CardsByList } from "@/components/board-view";
import type { List } from "@/db/schema";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string; boardId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { id: workspaceId, boardId } = await params;

  const workspace = await getWorkspaceDetail(workspaceId);
  if (!workspace) notFound();

  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  if (!board || board.workspaceId !== workspaceId) notFound();

  // Load lists first, then cards filtered by those list IDs
  const boardLists = await db
    .select()
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .orderBy(asc(lists.position));

  const cardsByList: CardsByList = {};
  for (const list of boardLists) cardsByList[list.id] = [];

  if (boardLists.length > 0) {
    const listIds = boardLists.map((l) => l.id);
    const allCards = await db
      .select()
      .from(cards)
      .where(inArray(cards.listId, listIds))
      .orderBy(asc(cards.position));

    for (const card of allCards) {
      if (cardsByList[card.listId]) cardsByList[card.listId].push(card);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border/40 bg-background/80 backdrop-blur-md px-5 py-3 shrink-0">
        <h1 className="font-heading font-bold text-lg">{board.name}</h1>
        <span className="text-muted-foreground text-xs">/</span>
        <span className="text-sm text-muted-foreground">{workspace.name}</span>
      </header>

      <div className="flex-1 overflow-hidden p-4">
        <BoardView
          boardId={boardId}
          currentUserId={session.userId}
          initialLists={boardLists as List[]}
          initialCards={cardsByList}
        />
      </div>
    </div>
  );
}
