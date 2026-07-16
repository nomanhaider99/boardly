"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boards, workspaceMembers, users, boardMemberLabels } from "@/db/schema";
import { getSession } from "@/lib/auth";

export type BoardActionResult =
  | { success: true; boardId: string }
  | { success: false; error: string };

export type BoardLabelResult = { success: boolean; error?: string };

export type MemberWithBoardLabel = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  workspaceRoleLabel: string | null;
  boardLabel: string | null;
};

async function getWorkspaceIdForBoard(boardId: string): Promise<string | null> {
  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  return board?.workspaceId ?? null;
}

async function assertBoardOwner(boardId: string, userId: string): Promise<boolean> {
  const workspaceId = await getWorkspaceIdForBoard(boardId);
  if (!workspaceId) return false;
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return member?.role === "owner";
}

export async function getBoardMemberLabels(boardId: string): Promise<MemberWithBoardLabel[]> {
  const session = await getSession();
  if (!session) return [];

  const workspaceId = await getWorkspaceIdForBoard(boardId);
  if (!workspaceId) return [];

  const members = await db
    .select({
      userId: workspaceMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      workspaceRoleLabel: workspaceMembers.roleLabel,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  const labels = await db
    .select({ userId: boardMemberLabels.userId, label: boardMemberLabels.label })
    .from(boardMemberLabels)
    .where(eq(boardMemberLabels.boardId, boardId));

  const labelMap = Object.fromEntries(labels.map((l) => [l.userId, l.label]));

  return members.map((m) => ({ ...m, boardLabel: labelMap[m.userId] ?? null }));
}

export async function setBoardMemberLabel(
  boardId: string,
  targetUserId: string,
  label: string | null
): Promise<BoardLabelResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const isOwner = await assertBoardOwner(boardId, session.userId);
  if (!isOwner) return { success: false, error: "Only workspace owners can set board labels." };

  if (!label || !label.trim()) {
    await db
      .delete(boardMemberLabels)
      .where(and(eq(boardMemberLabels.boardId, boardId), eq(boardMemberLabels.userId, targetUserId)));
    return { success: true };
  }

  const parsed = z.string().max(50).safeParse(label.trim());
  if (!parsed.success) return { success: false, error: "Label must be 50 characters or less." };

  await db
    .insert(boardMemberLabels)
    .values({ boardId, userId: targetUserId, label: parsed.data })
    .onConflictDoUpdate({
      target: [boardMemberLabels.boardId, boardMemberLabels.userId],
      set: { label: parsed.data },
    });

  return { success: true };
}

async function assertMember(workspaceId: string, userId: string) {
  const [m] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);
  return m ?? null;
}

export async function createBoard(
  workspaceId: string,
  formData: FormData
): Promise<BoardActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const name = z.string().min(1).max(80).safeParse(formData.get("name"));
  if (!name.success) return { success: false, error: "Board name is required." };

  const member = await assertMember(workspaceId, session.userId);
  if (!member) return { success: false, error: "Workspace not found." };

  const [board] = await db
    .insert(boards)
    .values({ workspaceId, name: name.data })
    .returning({ id: boards.id });

  return { success: true, boardId: board.id };
}

export async function getBoards(workspaceId: string) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const member = await assertMember(workspaceId, session.userId);
  if (!member) return [];

  return db
    .select()
    .from(boards)
    .where(eq(boards.workspaceId, workspaceId));
}

export async function deleteBoard(boardId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  if (!board) return { success: false, error: "Board not found." };

  const member = await assertMember(board.workspaceId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  await db.delete(boards).where(eq(boards.id, boardId));
  return { success: true };
}
