import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  boards,
  chatGroupMembers,
  chatGroups,
  users,
  workspaceMembers,
} from "@/db/schema";
import { getSession } from "@/lib/auth";

// POST /api/board/[boardId]/chat/groups/[groupId]/members — add members
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; groupId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId, groupId } = await params;

  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  // Group must belong to this board
  const [group] = await db
    .select({ id: chatGroups.id })
    .from(chatGroups)
    .where(and(eq(chatGroups.id, groupId), eq(chatGroups.boardId, boardId)))
    .limit(1);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // Requester must already be a member of the group
  const [membership] = await db
    .select({ userId: chatGroupMembers.userId })
    .from(chatGroupMembers)
    .where(
      and(
        eq(chatGroupMembers.groupId, groupId),
        eq(chatGroupMembers.userId, session.userId)
      )
    )
    .limit(1);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await req.json();
  const parsed = z
    .object({ memberIds: z.array(z.string().uuid()).min(1).max(100) })
    .safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Only allow people who belong to this board's workspace
  const wsMembers = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, board.workspaceId));
  const allowed = new Set(wsMembers.map((m) => m.userId));

  // Exclude anyone already in the group
  const existing = await db
    .select({ userId: chatGroupMembers.userId })
    .from(chatGroupMembers)
    .where(eq(chatGroupMembers.groupId, groupId));
  const already = new Set(existing.map((m) => m.userId));

  const toAdd = [
    ...new Set(parsed.data.memberIds.filter((id) => allowed.has(id) && !already.has(id))),
  ];

  if (toAdd.length > 0) {
    await db
      .insert(chatGroupMembers)
      .values(toAdd.map((userId) => ({ groupId, userId })))
      .onConflictDoNothing();
  }

  // Return the refreshed member list
  const memberRows = await db
    .select({
      userId: chatGroupMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(chatGroupMembers)
    .innerJoin(users, eq(chatGroupMembers.userId, users.id))
    .where(eq(chatGroupMembers.groupId, groupId));

  return NextResponse.json({
    members: memberRows,
    memberCount: memberRows.length,
    added: toAdd.length,
  });
}

// DELETE /api/board/[boardId]/chat/groups/[groupId]/members?userId=<id>
// Removing yourself = leaving the group. Removing someone else requires
// being the group's creator.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; groupId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId, groupId } = await params;

  const targetId = req.nextUrl.searchParams.get("userId");
  const parsed = z.string().uuid().safeParse(targetId);
  if (!parsed.success) return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  const target = parsed.data;

  const [group] = await db
    .select({ id: chatGroups.id, createdByUserId: chatGroups.createdByUserId })
    .from(chatGroups)
    .where(and(eq(chatGroups.id, groupId), eq(chatGroups.boardId, boardId)))
    .limit(1);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // Requester must be a member of the group
  const [membership] = await db
    .select({ userId: chatGroupMembers.userId })
    .from(chatGroupMembers)
    .where(
      and(
        eq(chatGroupMembers.groupId, groupId),
        eq(chatGroupMembers.userId, session.userId)
      )
    )
    .limit(1);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isSelf = target === session.userId;
  const isCreator = session.userId === group.createdByUserId;
  // You can always remove yourself (leave); only the creator can remove others.
  if (!isSelf && !isCreator) {
    return NextResponse.json(
      { error: "Only the group creator can remove members" },
      { status: 403 }
    );
  }

  await db
    .delete(chatGroupMembers)
    .where(
      and(
        eq(chatGroupMembers.groupId, groupId),
        eq(chatGroupMembers.userId, target)
      )
    );

  // Remaining members after removal
  const remaining = await db
    .select({
      userId: chatGroupMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      addedAt: chatGroupMembers.addedAt,
    })
    .from(chatGroupMembers)
    .innerJoin(users, eq(chatGroupMembers.userId, users.id))
    .where(eq(chatGroupMembers.groupId, groupId))
    .orderBy(asc(chatGroupMembers.addedAt));

  // Empty group → delete it entirely (messages cascade)
  if (remaining.length === 0) {
    await db.delete(chatGroups).where(eq(chatGroups.id, groupId));
    return NextResponse.json({
      members: [],
      memberCount: 0,
      removed: target,
      groupDeleted: true,
    });
  }

  // If the creator left, hand ownership to the earliest-joined remaining member
  let createdByUserId = group.createdByUserId;
  if (target === group.createdByUserId) {
    createdByUserId = remaining[0].userId;
    await db
      .update(chatGroups)
      .set({ createdByUserId })
      .where(eq(chatGroups.id, groupId));
  }

  return NextResponse.json({
    members: remaining.map((m) => ({
      userId: m.userId,
      firstName: m.firstName,
      lastName: m.lastName,
      avatarUrl: m.avatarUrl,
    })),
    memberCount: remaining.length,
    removed: target,
    groupDeleted: false,
    createdByUserId,
  });
}
