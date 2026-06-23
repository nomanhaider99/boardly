"use server";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attachments, cards, lists, boards, workspaceMembers, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { UTApi } from "uploadthing/server";

export type AttachmentActionResult =
  | { success: true }
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

export async function saveAttachment(
  cardId: string,
  file: { url: string; name: string; size: number; type: string }
): Promise<AttachmentActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const member = await assertCardMember(cardId, session.userId);
  if (!member) return { success: false, error: "Card not found." };

  const isImage = /^image\//.test(file.type);

  await db.insert(attachments).values({
    cardId,
    url: file.url,
    type: isImage ? "image" : "document",
    fileName: file.name,
    size: file.size,
    uploadedByUserId: session.userId,
  });

  return { success: true };
}

export async function deleteAttachment(attachmentId: string): Promise<AttachmentActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [attachment] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1);

  if (!attachment) return { success: false, error: "Attachment not found." };
  if (attachment.uploadedByUserId !== session.userId) return { success: false, error: "Not authorized." };

  // Delete from UploadThing storage
  try {
    const utapi = new UTApi();
    const fileKey = attachment.url.split("/f/")[1];
    if (fileKey) await utapi.deleteFiles(fileKey);
  } catch {
    // Non-fatal if storage delete fails — still remove DB record
  }

  await db.delete(attachments).where(eq(attachments.id, attachmentId));
  return { success: true };
}

export type AttachmentWithUploader = {
  id: string;
  url: string;
  type: string;
  fileName: string;
  size: number;
  createdAt: Date;
  uploadedByUserId: string;
  uploaderFirstName: string;
};

export async function getCardAttachments(cardId: string): Promise<AttachmentWithUploader[]> {
  const rows = await db
    .select({
      id: attachments.id,
      url: attachments.url,
      type: attachments.type,
      fileName: attachments.fileName,
      size: attachments.size,
      createdAt: attachments.createdAt,
      uploadedByUserId: attachments.uploadedByUserId,
      uploaderFirstName: users.firstName,
    })
    .from(attachments)
    .innerJoin(users, eq(attachments.uploadedByUserId, users.id))
    .where(eq(attachments.cardId, cardId))
    .orderBy(asc(attachments.createdAt));

  return rows;
}
