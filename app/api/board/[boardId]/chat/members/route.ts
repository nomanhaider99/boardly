import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { boardMessages, boards, users, workspaceMembers } from "@/db/schema";
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

  const [myMembership] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, board.workspaceId),
        eq(workspaceMembers.userId, session.userId)
      )
    )
    .limit(1);
  if (!myMembership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // All workspace members except me
  const allMembers = await db
    .select({
      userId: workspaceMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, board.workspaceId));

  const otherMembers = allMembers.filter((m) => m.userId !== session.userId);

  // Fetch all DMs involving me on this board to compute last-message previews
  const myDms = await db
    .select({
      id: boardMessages.id,
      fromUserId: boardMessages.fromUserId,
      toUserId: boardMessages.toUserId,
      body: boardMessages.body,
      createdAt: boardMessages.createdAt,
    })
    .from(boardMessages)
    .where(
      and(
        eq(boardMessages.boardId, boardId),
        or(
          eq(boardMessages.fromUserId, session.userId),
          eq(boardMessages.toUserId, session.userId)
        )
      )
    )
    .orderBy(desc(boardMessages.createdAt));

  // Build last-message map keyed by partner userId
  const lastByPartner: Record<string, (typeof myDms)[0]> = {};
  for (const msg of myDms) {
    const partnerId =
      msg.fromUserId === session.userId ? msg.toUserId : msg.fromUserId;
    if (!lastByPartner[partnerId]) lastByPartner[partnerId] = msg;
  }

  const result = otherMembers.map((m) => ({
    ...m,
    lastMessage: lastByPartner[m.userId]
      ? {
          body: lastByPartner[m.userId].body,
          createdAt: lastByPartner[m.userId].createdAt,
          fromMe: lastByPartner[m.userId].fromUserId === session.userId,
        }
      : null,
  }));

  // Sort: members with recent messages first, then alphabetically
  result.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) {
      return (
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
      );
    }
    if (a.lastMessage) return -1;
    if (b.lastMessage) return 1;
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });

  return NextResponse.json({ members: result });
}
