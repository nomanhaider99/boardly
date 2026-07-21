import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gt, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  boardMessages,
  boards,
  chatGroupMembers,
  chatGroups,
  users,
  workspaceMembers,
} from "@/db/schema";
import { getSession } from "@/lib/auth";

const MAX_MESSAGES = 25;

/**
 * GET /api/board/[boardId]/chat/inbox?since=<ISO>
 *
 * Every message addressed to the current user — DMs plus any group they belong
 * to — that landed after `since`, excluding their own. Drives the new-message
 * toast and the unread badge, so it covers all conversations, not just the one
 * that happens to be open.
 *
 * Always returns `now` (server clock): the client uses it as the next cursor,
 * which keeps the window skew-free and gap-free.
 */
export async function GET(
  req: NextRequest,
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

  const now = new Date();
  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  // No cursor yet — hand back the clock so the client starts from "right now"
  // and doesn't toast a backlog of history.
  if (!since || Number.isNaN(since.getTime())) {
    return NextResponse.json({ messages: [], now: now.toISOString() });
  }

  const myGroups = await db
    .select({ id: chatGroups.id, name: chatGroups.name })
    .from(chatGroups)
    .innerJoin(chatGroupMembers, eq(chatGroupMembers.groupId, chatGroups.id))
    .where(
      and(
        eq(chatGroups.boardId, boardId),
        eq(chatGroupMembers.userId, session.userId)
      )
    );

  const groupNameById = new Map(myGroups.map((g) => [g.id, g.name]));
  const groupIds = myGroups.map((g) => g.id);

  const addressedToMe = groupIds.length
    ? or(
        and(eq(boardMessages.toUserId, session.userId), isNull(boardMessages.groupId)),
        inArray(boardMessages.groupId, groupIds)
      )
    : and(eq(boardMessages.toUserId, session.userId), isNull(boardMessages.groupId));

  const rows = await db
    .select({
      id: boardMessages.id,
      body: boardMessages.body,
      createdAt: boardMessages.createdAt,
      fromUserId: boardMessages.fromUserId,
      toUserId: boardMessages.toUserId,
      groupId: boardMessages.groupId,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(boardMessages)
    .innerJoin(users, eq(boardMessages.fromUserId, users.id))
    .where(
      and(
        eq(boardMessages.boardId, boardId),
        gt(boardMessages.createdAt, since),
        lte(boardMessages.createdAt, now),
        // Excluded in SQL, not after: filtering post-LIMIT would let a burst of
        // my own messages crowd real ones out of the window for good.
        ne(boardMessages.fromUserId, session.userId),
        addressedToMe
      )
    )
    .orderBy(asc(boardMessages.createdAt))
    .limit(MAX_MESSAGES);

  const messages = rows.map((m) => ({
    ...m,
    groupName: m.groupId ? groupNameById.get(m.groupId) ?? null : null,
  }));

  return NextResponse.json({ messages, now: now.toISOString() });
}
