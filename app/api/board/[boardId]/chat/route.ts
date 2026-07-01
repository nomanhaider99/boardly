import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gt } from "drizzle-orm";
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;
  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;

  const rows = since
    ? await db
        .select({
          id: boardMessages.id,
          body: boardMessages.body,
          createdAt: boardMessages.createdAt,
          userId: boardMessages.userId,
          firstName: users.firstName,
          lastName: users.lastName,
          avatarUrl: users.avatarUrl,
        })
        .from(boardMessages)
        .innerJoin(users, eq(boardMessages.userId, users.id))
        .where(
          and(
            eq(boardMessages.boardId, boardId),
            gt(boardMessages.createdAt, since)
          )
        )
        .orderBy(asc(boardMessages.createdAt))
    : await db
        .select({
          id: boardMessages.id,
          body: boardMessages.body,
          createdAt: boardMessages.createdAt,
          userId: boardMessages.userId,
          firstName: users.firstName,
          lastName: users.lastName,
          avatarUrl: users.avatarUrl,
        })
        .from(boardMessages)
        .innerJoin(users, eq(boardMessages.userId, users.id))
        .where(eq(boardMessages.boardId, boardId))
        .orderBy(desc(boardMessages.createdAt))
        .limit(60)
        .then((r) => r.reverse());

  return NextResponse.json({ messages: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;
  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = z.object({ body: z.string().min(1).max(2000) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [inserted] = await db
    .insert(boardMessages)
    .values({ boardId, userId: session.userId, body: parsed.data.body })
    .returning({
      id: boardMessages.id,
      body: boardMessages.body,
      createdAt: boardMessages.createdAt,
      userId: boardMessages.userId,
    });

  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return NextResponse.json({
    message: { ...inserted, ...user },
  });
}
