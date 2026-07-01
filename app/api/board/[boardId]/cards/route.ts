import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards, lists, boards, workspaceMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;

  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const [member] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, board.workspaceId),
        eq(workspaceMembers.userId, session.userId)
      )
    )
    .limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const boardLists = await db
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .orderBy(asc(lists.position));

  if (boardLists.length === 0) {
    return NextResponse.json({ lists: [] });
  }

  const listIds = boardLists.map((l) => l.id);

  const boardCards = await db
    .select({ id: cards.id, listId: cards.listId })
    .from(cards)
    .where(inArray(cards.listId, listIds))
    .orderBy(asc(cards.position));

  const cardIdsByList: Record<string, string[]> = {};
  for (const id of listIds) cardIdsByList[id] = [];
  for (const card of boardCards) cardIdsByList[card.listId].push(card.id);

  return NextResponse.json({
    lists: listIds.map((listId) => ({ listId, cardIds: cardIdsByList[listId] })),
  });
}
