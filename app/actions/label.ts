"use server";

import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cardLabels, cardLabelAssignments, cards, lists, boards, workspaceMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export type LabelActionResult =
  | { success: true; labelId?: string }
  | { success: false; error: string };

async function assertBoardMember(boardId: string, userId: string) {
  const [board] = await db.select({ workspaceId: boards.workspaceId }).from(boards).where(eq(boards.id, boardId)).limit(1);
  if (!board) return null;
  const [m] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, board.workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return m ?? null;
}

export async function getBoardLabels(boardId: string) {
  const session = await getSession();
  if (!session) return [];

  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return [];

  return db
    .select()
    .from(cardLabels)
    .where(eq(cardLabels.boardId, boardId))
    .orderBy(asc(cardLabels.position), asc(cardLabels.createdAt));
}

export async function createCardLabel(
  boardId: string,
  formData: FormData
): Promise<LabelActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return { success: false, error: "Board not found." };

  const title = z.string().min(1).max(30).safeParse(formData.get("title"));
  if (!title.success) return { success: false, error: "Title is required (max 30 chars)." };

  const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).safeParse(formData.get("color"));
  if (!color.success) return { success: false, error: "Invalid color format." };

  const type = z.enum(["custom", "priority"]).safeParse(formData.get("type") ?? "custom");
  if (!type.success) return { success: false, error: "Invalid type." };

  const [maxPos] = await db
    .select({ pos: cardLabels.position })
    .from(cardLabels)
    .where(eq(cardLabels.boardId, boardId))
    .orderBy(asc(cardLabels.position))
    .limit(1);

  const [label] = await db
    .insert(cardLabels)
    .values({
      boardId,
      title: title.data,
      color: color.data,
      type: type.data,
      position: (maxPos?.pos ?? -1) + 1,
    })
    .returning({ id: cardLabels.id });

  return { success: true, labelId: label.id };
}

export async function assignLabelToCard(
  cardId: string,
  labelId: string
): Promise<LabelActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [card] = await db.select({ listId: cards.listId }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) return { success: false, error: "Card not found." };

  const [list] = await db.select({ boardId: lists.boardId }).from(lists).where(eq(lists.id, card.listId)).limit(1);
  if (!list) return { success: false, error: "List not found." };

  const member = await assertBoardMember(list.boardId, session.userId);
  if (!member) return { success: false, error: "Not a board member." };

  const [label] = await db
    .select({ boardId: cardLabels.boardId })
    .from(cardLabels)
    .where(eq(cardLabels.id, labelId))
    .limit(1);
  if (!label || label.boardId !== list.boardId) return { success: false, error: "Label not on this board." };

  await db
    .insert(cardLabelAssignments)
    .values({ cardId, labelId })
    .onConflictDoNothing();

  return { success: true };
}

export async function unassignLabelFromCard(
  cardId: string,
  labelId: string
): Promise<LabelActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [card] = await db.select({ listId: cards.listId }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) return { success: false, error: "Card not found." };

  const [list] = await db.select({ boardId: lists.boardId }).from(lists).where(eq(lists.id, card.listId)).limit(1);
  if (!list) return { success: false, error: "List not found." };

  const member = await assertBoardMember(list.boardId, session.userId);
  if (!member) return { success: false, error: "Not a board member." };

  await db
    .delete(cardLabelAssignments)
    .where(and(eq(cardLabelAssignments.cardId, cardId), eq(cardLabelAssignments.labelId, labelId)));

  return { success: true };
}

export async function deleteCardLabel(labelId: string): Promise<LabelActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [label] = await db.select({ boardId: cardLabels.boardId }).from(cardLabels).where(eq(cardLabels.id, labelId)).limit(1);
  if (!label) return { success: false, error: "Label not found." };

  const member = await assertBoardMember(label.boardId, session.userId);
  if (!member || member.role !== "owner") return { success: false, error: "Only workspace owners can delete labels." };

  await db.delete(cardLabels).where(eq(cardLabels.id, labelId));
  return { success: true };
}

export async function getCardLabels(cardId: string) {
  return db
    .select()
    .from(cardLabels)
    .innerJoin(cardLabelAssignments, eq(cardLabels.id, cardLabelAssignments.labelId))
    .where(eq(cardLabelAssignments.cardId, cardId))
    .orderBy(asc(cardLabels.position));
}

export async function getLabelsForCards(cardIds: string[]) {
  if (cardIds.length === 0) return [];
  return db
    .select({
      label: cardLabels,
      cardId: cardLabelAssignments.cardId,
    })
    .from(cardLabelAssignments)
    .innerJoin(cardLabels, eq(cardLabelAssignments.labelId, cardLabels.id))
    .where(inArray(cardLabelAssignments.cardId, cardIds))
    .orderBy(asc(cardLabels.position));
}

export async function seedDefaultPriorityLabels(boardId: string) {
  const session = await getSession();
  if (!session) return;

  const member = await assertBoardMember(boardId, session.userId);
  if (!member || member.role !== "owner") return;

  const existing = await db
    .select()
    .from(cardLabels)
    .where(and(eq(cardLabels.boardId, boardId), eq(cardLabels.type, "priority")));
  if (existing.length > 0) return;

  const defaults = [
    { title: "Critical", color: "#dc2626", position: 0 },
    { title: "Urgent", color: "#ea580c", position: 1 },
    { title: "Normal", color: "#2563eb", position: 2 },
    { title: "No Rush", color: "#16a34a", position: 3 },
  ];

  await Promise.all(
    defaults.map((d, i) =>
      db.insert(cardLabels).values({
        boardId,
        title: d.title,
        color: d.color,
        type: "priority",
        position: d.position,
      })
    )
  );
}