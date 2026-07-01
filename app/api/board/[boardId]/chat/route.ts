import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { boardMessages, boards, users, workspaceMembers } from "@/db/schema";
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
  if (!partnerId) return NextResponse.json({ error: "Missing partner" }, { status: 400 });

  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  const me = session.userId;

  const fromAlias = users;
  const dmFilter = and(
    eq(boardMessages.boardId, boardId),
    or(
      and(eq(boardMessages.fromUserId, me), eq(boardMessages.toUserId, partnerId)),
      and(eq(boardMessages.fromUserId, partnerId), eq(boardMessages.toUserId, me))
    ),
    since ? gt(boardMessages.createdAt, since) : undefined
  );

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
    .object({ toUserId: z.string().uuid(), body: z.string().min(1).max(2000) })
    .safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [inserted] = await db
    .insert(boardMessages)
    .values({
      boardId,
      fromUserId: session.userId,
      toUserId: parsed.data.toUserId,
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
