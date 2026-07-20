import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
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

async function getBoardWorkspace(boardId: string, userId: string) {
  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) return { board: null, member: null };

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

  return { board, member: member ?? null };
}

// GET /api/board/[boardId]/chat/groups — groups the current user belongs to
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;
  const { board, member } = await getBoardWorkspace(boardId, session.userId);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Groups on this board where I'm a member
  const myGroups = await db
    .select({
      id: chatGroups.id,
      name: chatGroups.name,
      createdByUserId: chatGroups.createdByUserId,
      createdAt: chatGroups.createdAt,
    })
    .from(chatGroups)
    .innerJoin(chatGroupMembers, eq(chatGroupMembers.groupId, chatGroups.id))
    .where(
      and(
        eq(chatGroups.boardId, boardId),
        eq(chatGroupMembers.userId, session.userId)
      )
    )
    .orderBy(desc(chatGroups.createdAt));

  if (myGroups.length === 0) return NextResponse.json({ groups: [] });

  const groupIds = myGroups.map((g) => g.id);

  // All members of those groups (with names)
  const memberRows = await db
    .select({
      groupId: chatGroupMembers.groupId,
      userId: chatGroupMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(chatGroupMembers)
    .innerJoin(users, eq(chatGroupMembers.userId, users.id))
    .where(inArray(chatGroupMembers.groupId, groupIds));

  const membersByGroup: Record<string, typeof memberRows> = {};
  for (const r of memberRows) {
    (membersByGroup[r.groupId] ||= []).push(r);
  }

  // Last message per group (fetch recent, keep first per group)
  const recent = await db
    .select({
      groupId: boardMessages.groupId,
      body: boardMessages.body,
      createdAt: boardMessages.createdAt,
      fromUserId: boardMessages.fromUserId,
      firstName: users.firstName,
    })
    .from(boardMessages)
    .innerJoin(users, eq(boardMessages.fromUserId, users.id))
    .where(inArray(boardMessages.groupId, groupIds))
    .orderBy(desc(boardMessages.createdAt));

  const lastByGroup: Record<string, (typeof recent)[number]> = {};
  for (const m of recent) {
    if (m.groupId && !lastByGroup[m.groupId]) lastByGroup[m.groupId] = m;
  }

  const groups = myGroups.map((g) => {
    const gm = (membersByGroup[g.id] || []).map((m) => ({
      userId: m.userId,
      firstName: m.firstName,
      lastName: m.lastName,
      avatarUrl: m.avatarUrl,
    }));
    const last = lastByGroup[g.id];
    return {
      id: g.id,
      name: g.name,
      createdByUserId: g.createdByUserId,
      members: gm,
      memberCount: gm.length,
      lastMessage: last
        ? {
            body: last.body,
            createdAt: last.createdAt,
            fromMe: last.fromUserId === session.userId,
            fromName: last.firstName,
          }
        : null,
    };
  });

  // Most recently active first
  groups.sort((a, b) => {
    const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return bt - at;
  });

  return NextResponse.json({ groups });
}

// POST /api/board/[boardId]/chat/groups — create a group with selected members
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { boardId } = await params;
  const { board, member } = await getBoardWorkspace(boardId, session.userId);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await req.json();
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      memberIds: z.array(z.string().uuid()).min(1).max(100),
    })
    .safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Only allow adding people who belong to this board's workspace
  const wsMembers = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, board.workspaceId));
  const allowed = new Set(wsMembers.map((m) => m.userId));

  const memberIds = new Set(
    parsed.data.memberIds.filter((id) => allowed.has(id))
  );
  memberIds.add(session.userId); // creator is always a member
  if (memberIds.size < 2) {
    return NextResponse.json(
      { error: "Select at least one other member" },
      { status: 400 }
    );
  }

  const [group] = await db
    .insert(chatGroups)
    .values({
      boardId,
      name: parsed.data.name,
      createdByUserId: session.userId,
    })
    .returning();

  await db
    .insert(chatGroupMembers)
    .values([...memberIds].map((userId) => ({ groupId: group.id, userId })));

  const memberRows = await db
    .select({
      userId: chatGroupMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
    })
    .from(chatGroupMembers)
    .innerJoin(users, eq(chatGroupMembers.userId, users.id))
    .where(eq(chatGroupMembers.groupId, group.id));

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      createdByUserId: group.createdByUserId,
      members: memberRows,
      memberCount: memberRows.length,
      lastMessage: null,
    },
  });
}
