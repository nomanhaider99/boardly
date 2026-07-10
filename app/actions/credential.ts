"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cardCredentials, credentialFields, cards, lists, boards, workspaceMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export type CredentialActionResult =
  | { success: true; credentialId?: string }
  | { success: false; error: string };

async function assertCardAccess(cardId: string, userId: string) {
  const [card] = await db.select({ listId: cards.listId }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) return null;

  const [list] = await db.select({ boardId: lists.boardId }).from(lists).where(eq(lists.id, card.listId)).limit(1);
  if (!list) return null;

  const [board] = await db.select({ workspaceId: boards.workspaceId }).from(boards).where(eq(boards.id, list.boardId)).limit(1);
  if (!board) return null;

  const [m] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, board.workspaceId), eq(workspaceMembers.userId, userId))).limit(1);
  return m ?? null;
}

export async function createCredential(
  cardId: string,
  formData: FormData
): Promise<CredentialActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const member = await assertCardAccess(cardId, session.userId);
  if (!member) return { success: false, error: "Card not found." };

  const title = z.string().min(1).max(100).safeParse(formData.get("title"));
  if (!title.success) return { success: false, error: "Title is required (max 100 chars)." };

  const icon = z.string().max(100).nullable().safeParse(formData.get("icon") || null);
  if (!icon.success) return { success: false, error: "Invalid icon." };

  const [credential] = await db
    .insert(cardCredentials)
    .values({ cardId, title: title.data, icon: icon.data, createdBy: session.userId })
    .returning({ id: cardCredentials.id });

  // Parse key-value pairs from form data
  const entries = Array.from(formData.entries());
  const fields = entries
    .filter(([k]) => k.startsWith("field_key_"))
    .map(([k, v]) => {
      const idx = k.replace("field_key_", "");
      return {
        key: v as string,
        value: formData.get(`field_value_${idx}`) as string,
        order: parseInt(idx, 10),
      };
    })
    .filter((f) => f.key.trim() && f.value.trim())
    .sort((a, b) => a.order - b.order);

  if (fields.length > 0) {
    await db.insert(credentialFields).values(
      fields.map((f) => ({
        credentialId: credential.id,
        key: f.key,
        value: f.value,
        order: f.order,
      }))
    );
  }

  return { success: true, credentialId: credential.id };
}

export async function updateCredential(
  credentialId: string,
  formData: FormData
): Promise<CredentialActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [credential] = await db
    .select({ cardId: cardCredentials.cardId })
    .from(cardCredentials)
    .where(eq(cardCredentials.id, credentialId))
    .limit(1);
  if (!credential) return { success: false, error: "Credential not found." };

  const member = await assertCardAccess(credential.cardId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  const title = z.string().min(1).max(100).safeParse(formData.get("title"));
  if (!title.success) return { success: false, error: "Title is required (max 100 chars)." };

  const icon = z.string().max(100).nullable().safeParse(formData.get("icon") || null);
  if (!icon.success) return { success: false, error: "Invalid icon." };

  await db.update(cardCredentials).set({ title: title.data, icon: icon.data }).where(eq(cardCredentials.id, credentialId));

  // Delete existing fields and re-insert
  await db.delete(credentialFields).where(eq(credentialFields.credentialId, credentialId));

  const entries = Array.from(formData.entries());
  const fields = entries
    .filter(([k]) => k.startsWith("field_key_"))
    .map(([k, v]) => {
      const idx = k.replace("field_key_", "");
      return {
        key: v as string,
        value: formData.get(`field_value_${idx}`) as string,
        order: parseInt(idx, 10),
      };
    })
    .filter((f) => f.key.trim() && f.value.trim())
    .sort((a, b) => a.order - b.order);

  if (fields.length > 0) {
    await db.insert(credentialFields).values(
      fields.map((f) => ({
        credentialId,
        key: f.key,
        value: f.value,
        order: f.order,
      }))
    );
  }

  return { success: true };
}

export async function deleteCredential(credentialId: string): Promise<CredentialActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [credential] = await db
    .select({ cardId: cardCredentials.cardId })
    .from(cardCredentials)
    .where(eq(cardCredentials.id, credentialId))
    .limit(1);
  if (!credential) return { success: false, error: "Credential not found." };

  const member = await assertCardAccess(credential.cardId, session.userId);
  if (!member) return { success: false, error: "Not authorized." };

  await db.delete(cardCredentials).where(eq(cardCredentials.id, credentialId));
  return { success: true };
}

export async function getCardCredentials(cardId: string) {
  const session = await getSession();
  if (!session) return [];

  const member = await assertCardAccess(cardId, session.userId);
  if (!member) return [];

  const credentials = await db
    .select()
    .from(cardCredentials)
    .where(eq(cardCredentials.cardId, cardId))
    .orderBy(cardCredentials.createdAt);

  // Fetch fields for each credential
  for (const cred of credentials) {
    const fields = await db
      .select()
      .from(credentialFields)
      .where(eq(credentialFields.credentialId, cred.id))
      .orderBy(credentialFields.order);
    (cred as any).fields = fields;
  }

  return credentials;
}