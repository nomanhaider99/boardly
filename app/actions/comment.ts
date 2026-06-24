"use server";

import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  comments,
  commentMentions,
  cards,
  lists,
  boards,
  workspaceMembers,
  users,
} from "@/db/schema";
import { getSession } from "@/lib/auth";

export type CommentActionResult =
  | { success: true; commentId?: string }
  | { success: false; error: string };

async function assertCardMember(cardId: string, userId: string) {
  const [card] = await db.select({ listId: cards.listId }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) return null;
  const [list] = await db.select({ boardId: lists.boardId }).from(lists).where(eq(lists.id, card.listId)).limit(1);
  if (!list) return null;
  const [board] = await db.select({ workspaceId: boards.workspaceId }).from(boards).where(eq(boards.id, list.boardId)).limit(1);
  if (!board) return null;
  const [m] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, board.workspaceId), eq(workspaceMembers.userId, userId))).limit(1);
  return m ?? null;
}

export async function addComment(
  cardId: string,
  data: { body: string; mentionedUserIds?: string[] }
): Promise<CommentActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const body = z.string().min(1).max(2000).safeParse(data.body);
  if (!body.success) return { success: false, error: "Comment body is required." };

  const member = await assertCardMember(cardId, session.userId);
  if (!member) return { success: false, error: "Card not found." };

  const [comment] = await db
    .insert(comments)
    .values({ cardId, userId: session.userId, body: body.data })
    .returning({ id: comments.id });

  const mentionedUserIds = data.mentionedUserIds ?? [];
  if (mentionedUserIds.length > 0) {
    await db.insert(commentMentions).values(
      mentionedUserIds.map((uid) => ({
        commentId: comment.id,
        mentionedUserId: uid,
      }))
    );
  }

  return { success: true, commentId: comment.id };
}

export async function deleteComment(commentId: string): Promise<CommentActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!comment) return { success: false, error: "Comment not found." };
  if (comment.userId !== session.userId) return { success: false, error: "Not your comment." };

  await db.delete(comments).where(eq(comments.id, commentId));
  return { success: true };
}

export type CommentWithUser = {
  id: string;
  body: string;
  createdAt: Date;
  userId: string;
  firstName: string;
  lastName: string;
};

export async function getCardComments(cardId: string): Promise<CommentWithUser[]> {
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: comments.userId,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.cardId, cardId))
    .orderBy(desc(comments.createdAt));

  return rows;
}

export type MemberForMention = {
  userId: string;
  firstName: string;
  lastName: string;
};

export async function getCardWorkspaceMembers(cardId: string): Promise<MemberForMention[]> {
  const session = await getSession();
  if (!session) return [];

  const [card] = await db.select({ listId: cards.listId }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) return [];

  const [list] = await db.select({ boardId: lists.boardId }).from(lists).where(eq(lists.id, card.listId)).limit(1);
  if (!list) return [];

  const [board] = await db.select({ workspaceId: boards.workspaceId }).from(boards).where(eq(boards.id, list.boardId)).limit(1);
  if (!board) return [];

  return db
    .select({
      userId: workspaceMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, board.workspaceId));
}
