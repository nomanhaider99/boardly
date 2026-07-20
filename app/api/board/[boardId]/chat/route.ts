import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
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

async function assertBoardMember(boardId: string, userId: string) {
  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) return null;

  const [member] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, board.workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);
  return member ?? null;
}

async function assertGroupMember(
  boardId: string,
  groupId: string,
  userId: string
) {
  const [row] = await db
    .select({ userId: chatGroupMembers.userId })
    .from(chatGroupMembers)
    .innerJoin(chatGroups, eq(chatGroupMembers.groupId, chatGroups.id))
    .where(
      and(
        eq(chatGroupMembers.groupId, groupId),
        eq(chatGroupMembers.userId, userId),
        eq(chatGroups.boardId, boardId)
      )
    )
    .limit(1);
  return row ?? null;
}

// GET /api/board/[boardId]/chat?partner=<userId>&since=<ISO>
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;
  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const partnerId = req.nextUrl.searchParams.get("partner");
  const groupId = req.nextUrl.searchParams.get("group");
  if (!partnerId && !groupId)
    return NextResponse.json({ error: "Missing partner or group" }, { status: 400 });

  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  const me = session.userId;
  const fromAlias = users;

  let convFilter;
  if (groupId) {
    const gm = await assertGroupMember(boardId, groupId, me);
    if (!gm) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    convFilter = and(
      eq(boardMessages.boardId, boardId),
      eq(boardMessages.groupId, groupId),
      since ? gt(boardMessages.createdAt, since) : undefined
    );
  } else {
    convFilter = and(
      eq(boardMessages.boardId, boardId),
      isNull(boardMessages.groupId),
      or(
        and(eq(boardMessages.fromUserId, me), eq(boardMessages.toUserId, partnerId!)),
        and(eq(boardMessages.fromUserId, partnerId!), eq(boardMessages.toUserId, me))
      ),
      since ? gt(boardMessages.createdAt, since) : undefined
    );
  }
  const dmFilter = convFilter;

  const rows = since
    ? await db
        .select({
          id: boardMessages.id,
          body: boardMessages.body,
          createdAt: boardMessages.createdAt,
          fromUserId: boardMessages.fromUserId,
          toUserId: boardMessages.toUserId,
          firstName: fromAlias.firstName,
          lastName: fromAlias.lastName,
        })
        .from(boardMessages)
        .innerJoin(fromAlias, eq(boardMessages.fromUserId, fromAlias.id))
        .where(dmFilter)
        .orderBy(asc(boardMessages.createdAt))
    : await db
        .select({
          id: boardMessages.id,
          body: boardMessages.body,
          createdAt: boardMessages.createdAt,
          fromUserId: boardMessages.fromUserId,
          toUserId: boardMessages.toUserId,
          firstName: fromAlias.firstName,
          lastName: fromAlias.lastName,
        })
        .from(boardMessages)
        .innerJoin(fromAlias, eq(boardMessages.fromUserId, fromAlias.id))
        .where(dmFilter)
        .orderBy(desc(boardMessages.createdAt))
        .limit(80)
        .then((r) => r.reverse());

  return NextResponse.json({ messages: rows });
}

// POST /api/board/[boardId]/chat
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;
  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await req.json();
  const parsed = z
    .object({
      toUserId: z.string().uuid().optional(),
      groupId: z.string().uuid().optional(),
      body: z.string().min(1).max(2000),
    })
    .refine((v) => !!v.toUserId !== !!v.groupId, {
      message: "Provide exactly one of toUserId or groupId",
    })
    .safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (parsed.data.groupId) {
    const gm = await assertGroupMember(boardId, parsed.data.groupId, session.userId);
    if (!gm) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [inserted] = await db
    .insert(boardMessages)
    .values({
      boardId,
      fromUserId: session.userId,
      toUserId: parsed.data.toUserId ?? null,
      groupId: parsed.data.groupId ?? null,
      body: parsed.data.body,
    })
    .returning();

  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return NextResponse.json({ message: { ...inserted, ...user } });
}
