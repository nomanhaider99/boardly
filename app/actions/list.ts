"use server";

import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lists, boards, workspaceMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export type ListActionResult =
  | { success: true; listId?: string }
  | { success: false; error: string };

async function assertBoardMember(boardId: string, userId: string) {
  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  if (!board) return null;

  const [m] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, board.workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);
  return m ?? null;
}

export async function createList(
  boardId: string,
  formData: FormData
): Promise<ListActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const title = z.string().min(1).max(100).safeParse(formData.get("title"));
  if (!title.success) return { success: false, error: "List title is required." };

  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return { success: false, error: "Board not found." };

  const existing = await db
    .select({ position: lists.position })
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .orderBy(asc(lists.position));

  const maxPos = existing.length > 0 ? existing[existing.length - 1].position : -1;

  const [list] = await db
    .insert(lists)
    .values({ boardId, title: title.data, position: maxPos + 1 })
    .returning({ id: lists.id });

  return { success: true, listId: list.id };
}

export async function updateListTitle(
  listId: string,
  title: string
): Promise<ListActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const parsed = z.string().min(1).max(100).safeParse(title);
  if (!parsed.success) return { success: false, error: "Title is required." };

  const [list] = await db
    .select({ boardId: lists.boardId })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);
  if (!list) return { success: false, error: "List not found." };

  const member = await assertBoardMember(list.boardId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  await db.update(lists).set({ title: parsed.data }).where(eq(lists.id, listId));
  return { success: true };
}

export async function deleteList(listId: string): Promise<ListActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [list] = await db
    .select({ boardId: lists.boardId })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);
  if (!list) return { success: false, error: "List not found." };

  const member = await assertBoardMember(list.boardId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  await db.delete(lists).where(eq(lists.id, listId));
  return { success: true };
}

export async function reorderLists(
  boardId: string,
  orderedIds: string[]
): Promise<ListActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(lists).set({ position: index }).where(eq(lists.id, id))
    )
  );
  return { success: true };
}

export async function getBoardLists(boardId: string) {
  return db
    .select()
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .orderBy(asc(lists.position));
}
