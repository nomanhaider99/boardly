"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers, users } from "@/db/schema";
import { getSession } from "@/lib/auth";

const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(50),
  description: z.string().max(200).optional(),
  iconColor: z.string().default("#22c55e"),
});

export type WorkspaceActionResult =
  | { success: true; workspaceId: string }
  | { success: false; error: string };

export async function createWorkspace(
  formData: FormData
): Promise<WorkspaceActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    iconColor: formData.get("iconColor") || "#22c55e",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { name, description, iconColor } = parsed.data;

  const [workspace] = await db
    .insert(workspaces)
    .values({ name, description, iconColor, ownerId: session.userId })
    .returning({ id: workspaces.id });

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: session.userId,
    role: "owner",
  });

  return { success: true, workspaceId: workspace.id };
}

export type WorkspaceWithRole = {
  id: string;
  name: string;
  description: string | null;
  iconColor: string;
  ownerId: string;
  createdAt: Date;
  role: "owner" | "member";
};

export async function getUserWorkspaces(): Promise<WorkspaceWithRole[]> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      iconColor: workspaces.iconColor,
      ownerId: workspaces.ownerId,
      createdAt: workspaces.createdAt,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, session.userId));

  return rows as WorkspaceWithRole[];
}

export type WorkspaceMemberWithUser = {
  userId: string;
  role: "owner" | "member";
  roleLabel: string | null;
  joinedAt: Date;
  firstName: string;
  lastName: string;
  email: string;
};

export type WorkspaceDetail = {
  id: string;
  name: string;
  description: string | null;
  iconColor: string;
  ownerId: string;
  createdAt: Date;
  members: WorkspaceMemberWithUser[];
  currentUserRole: "owner" | "member";
};

export async function getWorkspaceDetail(
  workspaceId: string
): Promise<WorkspaceDetail | null> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return null;

  const memberRows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      roleLabel: workspaceMembers.roleLabel,
      joinedAt: workspaceMembers.joinedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  const currentMember = memberRows.find((m) => m.userId === session.userId);
  if (!currentMember) return null; // not a member — no access

  return {
    ...workspace,
    members: memberRows as WorkspaceMemberWithUser[],
    currentUserRole: currentMember.role as "owner" | "member",
  };
}

export async function setMemberRoleLabel(
  workspaceId: string,
  targetUserId: string,
  roleLabel: string | null
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [caller] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!caller || caller.role !== "owner") {
    return { success: false, error: "Only workspace owners can assign role labels." };
  }

  const trimmed = roleLabel?.trim() ?? null;
  if (trimmed && trimmed.length > 50) {
    return { success: false, error: "Role label must be 50 characters or fewer." };
  }

  await db
    .update(workspaceMembers)
    .set({ roleLabel: trimmed || null })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId)
      )
    );

  return { success: true };
}
