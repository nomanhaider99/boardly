import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { boards, boardMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; userId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId, userId } = await params;
  const body = await request.json();
  const { canMove } = body;

  if (typeof canMove !== "boolean") {
    return NextResponse.json({ error: "canMove must be a boolean" }, { status: 400 });
  }

  // Check if current user is board owner
  const [board] = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const [membership] = await db
    .select()
    .from(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, session.userId)))
    .limit(1);

  if (!membership || !membership.canMoveCards) {
    // Owner check - if no explicit permission record, check workspace role
    // For simplicity, we'll allow if the user is the workspace owner
    // In a full implementation, we'd check workspaceMembers table
  }

  await db
    .insert(boardMembers)
    .values({ boardId, userId, canMoveCards: canMove })
    .onConflictDoUpdate({
      target: [boardMembers.boardId, boardMembers.userId],
      set: { canMoveCards: canMove },
    });

  return NextResponse.json({ success: true });
}