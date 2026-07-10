import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { boards, boardMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;
  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (name.length > 80) {
    return NextResponse.json({ error: "Name must be 80 characters or less" }, { status: 400 });
  }

  const [board] = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  // Check if user is a member of this board
  const [membership] = await db
    .select()
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, session.userId)))
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a board member" }, { status: 403 });
  }

  await db.update(boards).set({ name: name.trim() }).where(eq(boards.id, boardId));

  return NextResponse.json({ success: true, name: name.trim() });
}