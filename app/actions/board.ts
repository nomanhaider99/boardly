"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boards, workspaceMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export type BoardActionResult =
  | { success: true; boardId: string }
  | { success: false; error: string };

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
