import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { chatGroups } from "@/db/schema";
import { getSession } from "@/lib/auth";

async function loadGroup(boardId: string, groupId: string) {
  const [group] = await db
    .select({
      id: chatGroups.id,
      name: chatGroups.name,
      createdByUserId: chatGroups.createdByUserId,
    })
    .from(chatGroups)
    .where(and(eq(chatGroups.id, groupId), eq(chatGroups.boardId, boardId)))
    .limit(1);
  return group ?? null;
}

// PATCH /api/board/[boardId]/chat/groups/[groupId] — rename (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; groupId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId, groupId } = await params;
  const group = await loadGroup(boardId, groupId);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  if (group.createdByUserId !== session.userId) {
    return NextResponse.json(
      { error: "Only the group admin can rename the group" },
      { status: 403 }
    );
  }

  const raw = await req.json();
  const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  const [updated] = await db
    .update(chatGroups)
    .set({ name: parsed.data.name })
    .where(eq(chatGroups.id, groupId))
    .returning({ id: chatGroups.id, name: chatGroups.name });

  return NextResponse.json({ group: updated });
}

// DELETE /api/board/[boardId]/chat/groups/[groupId] — delete group (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string; groupId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId, groupId } = await params;
  const group = await loadGroup(boardId, groupId);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  if (group.createdByUserId !== session.userId) {
    return NextResponse.json(
      { error: "Only the group admin can delete the group" },
      { status: 403 }
    );
  }

  // Members and messages cascade via FK onDelete: "cascade"
  await db.delete(chatGroups).where(eq(chatGroups.id, groupId));

  return NextResponse.json({ deleted: true });
}
