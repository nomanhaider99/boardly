"use server";

import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards, lists, boards, workspaceMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export type CardActionResult =
  | { success: true; cardId?: string }
  | { success: false; error: string };

async function assertListMember(listId: string, userId: string) {
  const [list] = await db
    .select({ boardId: lists.boardId })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);
  if (!list) return null;

  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, list.boardId))
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

export async function createCard(
  listId: string,
  formData: FormData
): Promise<CardActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const title = z.string().min(1).max(200).safeParse(formData.get("title"));
  if (!title.success) return { success: false, error: "Card title is required." };

  const member = await assertListMember(listId, session.userId);
  if (!member) return { success: false, error: "List not found." };

  const existing = await db
    .select({ position: cards.position })
    .from(cards)
    .where(eq(cards.listId, listId))
    .orderBy(asc(cards.position));

  const maxPos = existing.length > 0 ? existing[existing.length - 1].position : -1;

  const [card] = await db
    .insert(cards)
    .values({ listId, title: title.data, position: maxPos + 1 })
    .returning({ id: cards.id });

  return { success: true, cardId: card.id };
}

export async function updateCard(
  cardId: string,
  data: { title?: string; description?: string; dueDate?: Date | null }
): Promise<CardActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [card] = await db
    .select({ listId: cards.listId })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  if (!card) return { success: false, error: "Card not found." };

  const member = await assertListMember(card.listId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  const update: Partial<typeof cards.$inferInsert> = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if ("dueDate" in data) update.dueDate = data.dueDate ?? undefined;

  await db.update(cards).set(update).where(eq(cards.id, cardId));
  return { success: true };
}

export async function deleteCard(cardId: string): Promise<CardActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [card] = await db
    .select({ listId: cards.listId })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  if (!card) return { success: false, error: "Card not found." };

  const member = await assertListMember(card.listId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  await db.delete(cards).where(eq(cards.id, cardId));
  return { success: true };
}

// Called after a drag-end: persist new card order and/or list move
export async function moveCard(
  cardId: string,
  targetListId: string,
  newPosition: number
): Promise<CardActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [card] = await db
    .select({ listId: cards.listId })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  if (!card) return { success: false, error: "Card not found." };

  const member = await assertListMember(targetListId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  await db
    .update(cards)
    .set({ listId: targetListId, position: newPosition })
    .where(eq(cards.id, cardId));

  return { success: true };
}

export async function reorderCards(
  listId: string,
  orderedIds: string[]
): Promise<CardActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const member = await assertListMember(listId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(cards).set({ position: index }).where(eq(cards.id, id))
    )
  );
  return { success: true };
}

export async function getListCards(listId: string) {
  return db
    .select()
    .from(cards)
    .where(eq(cards.listId, listId))
    .orderBy(asc(cards.position));
}
