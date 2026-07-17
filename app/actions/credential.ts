"use server";

import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cardCredentials,
  credentialFields,
  cards,
  lists,
  boards,
  workspaceMembers,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { encryptSecret, decryptSecret, isCredentialsSecretConfigured } from "@/lib/crypto";

export type CredentialActionResult =
  | { success: true; credentialId?: string }
  | { success: false; error: string };

export type CredentialFieldInput = { key: string; value: string };

// Metadata for listing — no secret values are included.
export type CredentialMeta = {
  id: string;
  title: string;
  icon: string | null;
  keys: string[];
  fieldCount: number;
};

export type CredentialFieldData = { key: string; value: string; order: number };

const fieldsSchema = z
  .array(z.object({ key: z.string().min(1).max(100), value: z.string().min(1).max(5000) }))
  .min(1)
  .max(50);

async function assertCardAccess(cardId: string, userId: string) {
  const [card] = await db.select({ listId: cards.listId }).from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card) return null;
  const [list] = await db.select({ boardId: lists.boardId }).from(lists).where(eq(lists.id, card.listId)).limit(1);
  if (!list) return null;
  const [board] = await db.select({ workspaceId: boards.workspaceId }).from(boards).where(eq(boards.id, list.boardId)).limit(1);
  if (!board) return null;
  const [m] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, board.workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return m ?? null;
}

async function assertCredentialAccess(credentialId: string, userId: string) {
  const [cred] = await db
    .select({ cardId: cardCredentials.cardId })
    .from(cardCredentials)
    .where(eq(cardCredentials.id, credentialId))
    .limit(1);
  if (!cred) return null;
  const member = await assertCardAccess(cred.cardId, userId);
  return member ? { cardId: cred.cardId } : null;
}

export async function getCardCredentialsMeta(cardId: string): Promise<CredentialMeta[]> {
  const session = await getSession();
  if (!session) return [];
  const member = await assertCardAccess(cardId, session.userId);
  if (!member) return [];

  const creds = await db
    .select()
    .from(cardCredentials)
    .where(eq(cardCredentials.cardId, cardId))
    .orderBy(asc(cardCredentials.createdAt));

  if (creds.length === 0) return [];

  const result: CredentialMeta[] = [];
  for (const c of creds) {
    const fields = await db
      .select({ key: credentialFields.key })
      .from(credentialFields)
      .where(eq(credentialFields.credentialId, c.id))
      .orderBy(asc(credentialFields.order));
    result.push({
      id: c.id,
      title: c.title,
      icon: c.icon,
      keys: fields.map((f) => f.key),
      fieldCount: fields.length,
    });
  }
  return result;
}

// Decrypt and return a single credential's fields — only on explicit reveal.
export async function revealCredentialFields(
  credentialId: string
): Promise<{ success: true; fields: CredentialFieldData[] } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };
  const access = await assertCredentialAccess(credentialId, session.userId);
  if (!access) return { success: false, error: "Credential not found." };

  const rows = await db
    .select()
    .from(credentialFields)
    .where(eq(credentialFields.credentialId, credentialId))
    .orderBy(asc(credentialFields.order));

  try {
    const fields = rows.map((r) => ({ key: r.key, value: decryptSecret(r.value), order: r.order }));
    return { success: true, fields };
  } catch {
    return { success: false, error: "Could not decrypt credentials (encryption key mismatch)." };
  }
}

export async function createCredential(
  cardId: string,
  data: { title: string; icon?: string | null; fields: CredentialFieldInput[] }
): Promise<CredentialActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };
  if (!isCredentialsSecretConfigured()) {
    return { success: false, error: "Credential storage is not configured (missing CREDENTIALS_SECRET)." };
  }
  const member = await assertCardAccess(cardId, session.userId);
  if (!member) return { success: false, error: "Card not found." };

  const title = z.string().min(1).max(100).safeParse(data.title.trim());
  if (!title.success) return { success: false, error: "Title is required (max 100 chars)." };

  const cleanFields = data.fields.map((f) => ({ key: f.key.trim(), value: f.value })).filter((f) => f.key && f.value);
  const parsed = fieldsSchema.safeParse(cleanFields);
  if (!parsed.success) return { success: false, error: "Add at least one key and value." };

  const icon = data.icon?.trim() || null;

  const [credential] = await db
    .insert(cardCredentials)
    .values({ cardId, title: title.data, icon, createdBy: session.userId })
    .returning({ id: cardCredentials.id });

  await db.insert(credentialFields).values(
    parsed.data.map((f, i) => ({
      credentialId: credential.id,
      key: f.key,
      value: encryptSecret(f.value),
      order: i,
    }))
  );

  return { success: true, credentialId: credential.id };
}

export async function updateCredential(
  credentialId: string,
  data: { title: string; icon?: string | null; fields: CredentialFieldInput[] }
): Promise<CredentialActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };
  if (!isCredentialsSecretConfigured()) {
    return { success: false, error: "Credential storage is not configured (missing CREDENTIALS_SECRET)." };
  }
  const access = await assertCredentialAccess(credentialId, session.userId);
  if (!access) return { success: false, error: "Credential not found." };

  const title = z.string().min(1).max(100).safeParse(data.title.trim());
  if (!title.success) return { success: false, error: "Title is required (max 100 chars)." };

  const cleanFields = data.fields.map((f) => ({ key: f.key.trim(), value: f.value })).filter((f) => f.key && f.value);
  const parsed = fieldsSchema.safeParse(cleanFields);
  if (!parsed.success) return { success: false, error: "Add at least one key and value." };

  const icon = data.icon?.trim() || null;

  await db.update(cardCredentials).set({ title: title.data, icon }).where(eq(cardCredentials.id, credentialId));

  // Replace fields wholesale.
  await db.delete(credentialFields).where(eq(credentialFields.credentialId, credentialId));
  await db.insert(credentialFields).values(
    parsed.data.map((f, i) => ({
      credentialId,
      key: f.key,
      value: encryptSecret(f.value),
      order: i,
    }))
  );

  return { success: true, credentialId };
}

export async function deleteCredential(credentialId: string): Promise<CredentialActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };
  const access = await assertCredentialAccess(credentialId, session.userId);
  if (!access) return { success: false, error: "Credential not found." };

  await db.delete(cardCredentials).where(eq(cardCredentials.id, credentialId));
  return { success: true };
}
