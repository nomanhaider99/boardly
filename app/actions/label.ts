"use server";

import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cardLabels,
  cardLabelAssignments,
  cards,
  lists,
  boards,
  workspaceMembers,
  type CardLabel,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { PRIORITY_LABELS } from "@/lib/labels";

export type LabelActionResult =
  | { success: true; label?: CardLabel }
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
    .where(and(eq(workspaceMembers.workspaceId, board.workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return m ?? null;
}

async function getBoardIdForCard(cardId: string): Promise<string | null> {
  const [card] = await db.select({ listId: cards.listId }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) return null;
  const [list] = await db.select({ boardId: lists.boardId }).from(lists).where(eq(lists.id, card.listId)).limit(1);
  return list?.boardId ?? null;
}

async function getBoardIdForLabel(labelId: string): Promise<string | null> {
  const [label] = await db.select({ boardId: cardLabels.boardId }).from(cardLabels).where(eq(cardLabels.id, labelId)).limit(1);
  return label?.boardId ?? null;
}

// Seed the built-in priority labels for a board. Safe to call once at creation.
export async function seedPriorityLabels(boardId: string): Promise<void> {
  await db.insert(cardLabels).values(
    PRIORITY_LABELS.map((l, i) => ({
      boardId,
      title: l.title,
      color: l.color,
      type: "priority" as const,
      position: i,
    }))
  );
}

export async function getBoardLabels(boardId: string): Promise<CardLabel[]> {
  const session = await getSession();
  if (!session) return [];
  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return [];

  const rows = await db
    .select()
    .from(cardLabels)
    .where(eq(cardLabels.boardId, boardId))
    .orderBy(asc(cardLabels.type), asc(cardLabels.position));

  // priority before custom (enum asc puts "custom" first, so re-sort)
  return rows.sort((a, b) => {
    if (a.type !== b.type) return a.type === "priority" ? -1 : 1;
    return a.position - b.position;
  });
}

export async function getCardLabelIds(cardId: string): Promise<string[]> {
  const rows = await db
    .select({ labelId: cardLabelAssignments.labelId })
    .from(cardLabelAssignments)
    .where(eq(cardLabelAssignments.cardId, cardId));
  return rows.map((r) => r.labelId);
}

// Map of cardId -> labelId[] for every card on a board (for the board view).
export async function getBoardCardLabelMap(boardId: string): Promise<Record<string, string[]>> {
  const rows = await db
    .select({ cardId: cardLabelAssignments.cardId, labelId: cardLabelAssignments.labelId })
    .from(cardLabelAssignments)
    .innerJoin(cards, eq(cardLabelAssignments.cardId, cards.id))
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(eq(lists.boardId, boardId));

  const map: Record<string, string[]> = {};
  for (const r of rows) {
    (map[r.cardId] ??= []).push(r.labelId);
  }
  return map;
}

export async function createLabel(
  boardId: string,
  data: { title: string; color: string }
): Promise<LabelActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };
  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return { success: false, error: "Board not found." };

  const title = z.string().min(1).max(50).safeParse(data.title.trim());
  if (!title.success) return { success: false, error: "Label title is required (max 50 chars)." };
  const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).safeParse(data.color);
  if (!color.success) return { success: false, error: "Invalid color." };

  const existing = await db
    .select({ position: cardLabels.position })
    .from(cardLabels)
    .where(eq(cardLabels.boardId, boardId));
  const maxPos = existing.reduce((m, r) => Math.max(m, r.position), -1);

  const [label] = await db
    .insert(cardLabels)
    .values({ boardId, title: title.data, color: color.data, type: "custom", position: maxPos + 1 })
    .returning();

  return { success: true, label };
}

export async function updateLabel(
  labelId: string,
  data: { title?: string; color?: string }
): Promise<LabelActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };
  const boardId = await getBoardIdForLabel(labelId);
  if (!boardId) return { success: false, error: "Label not found." };
  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  const update: Partial<typeof cardLabels.$inferInsert> = {};
  if (data.title !== undefined) {
    const t = z.string().min(1).max(50).safeParse(data.title.trim());
    if (!t.success) return { success: false, error: "Label title is required (max 50 chars)." };
    update.title = t.data;
  }
  if (data.color !== undefined) {
    const c = z.string().regex(/^#[0-9a-fA-F]{6}$/).safeParse(data.color);
    if (!c.success) return { success: false, error: "Invalid color." };
    update.color = c.data;
  }

  await db.update(cardLabels).set(update).where(eq(cardLabels.id, labelId));
  return { success: true };
}

export async function deleteLabel(labelId: string): Promise<LabelActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };
  const boardId = await getBoardIdForLabel(labelId);
  if (!boardId) return { success: false, error: "Label not found." };
  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  await db.delete(cardLabels).where(eq(cardLabels.id, labelId));
  return { success: true };
}

export async function setCardLabel(
  cardId: string,
  labelId: string,
  assigned: boolean
): Promise<LabelActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };
  const boardId = await getBoardIdForCard(cardId);
  if (!boardId) return { success: false, error: "Card not found." };
  const member = await assertBoardMember(boardId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  // Ensure the label belongs to the same board as the card.
  const labelBoardId = await getBoardIdForLabel(labelId);
  if (labelBoardId !== boardId) return { success: false, error: "Label not on this board." };

  if (assigned) {
    await db
      .insert(cardLabelAssignments)
      .values({ cardId, labelId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(cardLabelAssignments)
      .where(and(eq(cardLabelAssignments.cardId, cardId), eq(cardLabelAssignments.labelId, labelId)));
  }

  return { success: true };
}
