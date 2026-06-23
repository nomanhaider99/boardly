"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  workspaceInvites,
  workspaceMembers,
  workspaces,
  users,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { createEmailToken, verifyEmailToken } from "@/lib/auth";
import { sendWorkspaceInviteEmail } from "@/lib/email";

export type InviteActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

// ─── Send invite ──────────────────────────────────────────────────────────────
export async function sendInvite(
  workspaceId: string,
  formData: FormData
): Promise<InviteActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) return { success: false, error: "Invalid email address." };
  const invitedEmail = email.data.toLowerCase().trim();

  // Must be a member of this workspace to invite
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!membership) return { success: false, error: "Workspace not found." };

  // Not already a member
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, invitedEmail))
    .limit(1);

  if (existingUser.length > 0) {
    const [alreadyMember] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, existingUser[0].id)
        )
      )
      .limit(1);

    if (alreadyMember) {
      return { success: false, error: "This person is already a member." };
    }
  }

  // No pending invite already
  const [pendingInvite] = await db
    .select({ id: workspaceInvites.id })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        eq(workspaceInvites.invitedEmail, invitedEmail),
        eq(workspaceInvites.status, "pending")
      )
    )
    .limit(1);

  if (pendingInvite) {
    return { success: false, error: "An invite has already been sent to this email." };
  }

  // Create token & record
  const token = await createEmailToken(session.userId, 24 * 7); // 7 days

  await db.insert(workspaceInvites).values({
    workspaceId,
    invitedEmail,
    invitedByUserId: session.userId,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Fetch workspace + inviter name for email
  const [ws] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const [inviter] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  try {
    await sendWorkspaceInviteEmail(
      invitedEmail,
      token,
      ws.name,
      `${inviter.firstName} ${inviter.lastName}`
    );
  } catch {
    // Non-fatal — invite record still exists
  }

  return { success: true, message: `Invite sent to ${invitedEmail}` };
}

// ─── Get pending invites for current user ────────────────────────────────────
export type InviteWithWorkspace = {
  id: string;
  token: string;
  workspaceId: string;
  workspaceName: string;
  workspaceIconColor: string;
  inviterFirstName: string;
  inviterLastName: string;
  createdAt: Date;
  expiresAt: Date;
};

export async function getMyInvites(): Promise<InviteWithWorkspace[]> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [currentUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!currentUser) return [];

  const rows = await db
    .select({
      id: workspaceInvites.id,
      token: workspaceInvites.token,
      workspaceId: workspaceInvites.workspaceId,
      workspaceName: workspaces.name,
      workspaceIconColor: workspaces.iconColor,
      inviterFirstName: users.firstName,
      inviterLastName: users.lastName,
      createdAt: workspaceInvites.createdAt,
      expiresAt: workspaceInvites.expiresAt,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
    .innerJoin(users, eq(workspaceInvites.invitedByUserId, users.id))
    .where(
      and(
        eq(workspaceInvites.invitedEmail, currentUser.email),
        eq(workspaceInvites.status, "pending")
      )
    );

  return rows as InviteWithWorkspace[];
}

export async function getPendingInviteCount(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;

  const [currentUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!currentUser) return 0;

  const rows = await db
    .select({ id: workspaceInvites.id })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.invitedEmail, currentUser.email),
        eq(workspaceInvites.status, "pending")
      )
    );

  return rows.length;
}

// ─── Respond to invite ───────────────────────────────────────────────────────
export async function respondToInvite(
  inviteId: string,
  response: "accepted" | "declined"
): Promise<InviteActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [currentUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!currentUser) return { success: false, error: "User not found." };

  const [invite] = await db
    .select()
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        eq(workspaceInvites.invitedEmail, currentUser.email),
        eq(workspaceInvites.status, "pending")
      )
    )
    .limit(1);

  if (!invite) return { success: false, error: "Invite not found or already responded." };
  if (invite.expiresAt < new Date()) return { success: false, error: "This invite has expired." };

  await db
    .update(workspaceInvites)
    .set({ status: response })
    .where(eq(workspaceInvites.id, inviteId));

  if (response === "accepted") {
    // Check not already a member
    const [existing] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, invite.workspaceId),
          eq(workspaceMembers.userId, session.userId)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId: session.userId,
        role: "member",
      });
    }
  }

  return { success: true };
}

// ─── Accept via email token link ─────────────────────────────────────────────
export async function acceptInviteByToken(
  token: string
): Promise<{ success: true; workspaceId: string } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "unauthenticated" };

  // The token was signed with the inviter's userId as subject — we verify it's valid
  const isValid = await verifyEmailToken(token);
  if (!isValid) return { success: false, error: "Invalid or expired invite link." };

  const [invite] = await db
    .select()
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.token, token),
        eq(workspaceInvites.status, "pending")
      )
    )
    .limit(1);

  if (!invite) return { success: false, error: "Invite not found or already used." };
  if (invite.expiresAt < new Date()) return { success: false, error: "This invite link has expired." };

  // Verify the invite is for the logged-in user's email
  const [currentUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!currentUser || currentUser.email !== invite.invitedEmail) {
    return {
      success: false,
      error: `This invite was sent to ${invite.invitedEmail}. Sign in with that account to accept.`,
    };
  }

  await db
    .update(workspaceInvites)
    .set({ status: "accepted" })
    .where(eq(workspaceInvites.id, invite.id));

  const [existing] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, invite.workspaceId),
        eq(workspaceMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(workspaceMembers).values({
      workspaceId: invite.workspaceId,
      userId: session.userId,
      role: "member",
    });
  }

  return { success: true, workspaceId: invite.workspaceId };
}

// ─── Get pending invites sent from a workspace (for settings page) ───────────
export type SentInvite = {
  id: string;
  invitedEmail: string;
  createdAt: Date;
  expiresAt: Date;
};

export async function getWorkspaceSentInvites(
  workspaceId: string
): Promise<SentInvite[]> {
  const session = await getSession();
  if (!session) return [];

  const rows = await db
    .select({
      id: workspaceInvites.id,
      invitedEmail: workspaceInvites.invitedEmail,
      createdAt: workspaceInvites.createdAt,
      expiresAt: workspaceInvites.expiresAt,
    })
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        eq(workspaceInvites.status, "pending")
      )
    );

  return rows;
}
