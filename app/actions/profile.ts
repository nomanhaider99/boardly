"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

export type ProfileActionResult = { success: boolean; error?: string };

export async function updateProfile(data: {
  firstName: string;
  lastName: string;
}): Promise<ProfileActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const firstSchema = z.string().min(1).max(50);
  const lastSchema = z.string().min(1).max(50);
  const first = firstSchema.safeParse(data.firstName.trim());
  const last = lastSchema.safeParse(data.lastName.trim());
  if (!first.success || !last.success) return { success: false, error: "Invalid name." };

  await db
    .update(users)
    .set({ firstName: first.data, lastName: last.data })
    .where(eq(users.id, session.userId));

  return { success: true };
}

export async function updateAvatar(url: string): Promise<ProfileActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  await db.update(users).set({ avatarUrl: url }).where(eq(users.id, session.userId));
  return { success: true };
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<ProfileActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  if (data.newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters." };
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) return { success: false, error: "User not found." };

  const valid = await verifyPassword(data.currentPassword, user.passwordHash);
  if (!valid) return { success: false, error: "Current password is incorrect." };

  const newHash = await hashPassword(data.newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, session.userId));
  return { success: true };
}

export async function generate2FASetup(): Promise<{
  secret: string;
  qrUrl: string;
} | null> {
  const session = await getSession();
  if (!session) return null;

  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: "Boardly", label: session.email, secret });
  const qrUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, qrUrl };
}

export async function enable2FA(data: {
  code: string;
  secret: string;
}): Promise<{ success: boolean; error?: string; backupCodes?: string[] }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const isValid = verifySync({ secret: data.secret, token: data.code }).valid;
  if (!isValid) return { success: false, error: "Invalid code. Please try again." };

  const rawCodes = Array.from({ length: 8 }, () =>
    Math.random().toString(36).slice(2, 10).toUpperCase()
  );
  const hashedCodes = await Promise.all(rawCodes.map((c) => hashPassword(c)));

  await db
    .update(users)
    .set({
      twoFactorEnabled: true,
      twoFactorSecret: data.secret,
      twoFactorBackupCodes: JSON.stringify(hashedCodes),
    })
    .where(eq(users.id, session.userId));

  return { success: true, backupCodes: rawCodes };
}

export async function disable2FA(data: {
  credential: string;
}): Promise<ProfileActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated." };

  const [user] = await db
    .select({
      passwordHash: users.passwordHash,
      twoFactorSecret: users.twoFactorSecret,
      twoFactorBackupCodes: users.twoFactorBackupCodes,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) return { success: false, error: "User not found." };

  let valid = false;

  // Try as 6-digit TOTP code
  if (user.twoFactorSecret && /^\d{6}$/.test(data.credential)) {
    valid = verifySync({ secret: user.twoFactorSecret, token: data.credential }).valid;
  }

  // Try as current password
  if (!valid) {
    valid = await verifyPassword(data.credential, user.passwordHash);
  }

  // Try as backup code
  if (!valid && user.twoFactorBackupCodes) {
    const stored = JSON.parse(user.twoFactorBackupCodes) as string[];
    for (const hashed of stored) {
      if (await verifyPassword(data.credential, hashed)) {
        valid = true;
        break;
      }
    }
  }

  if (!valid) return { success: false, error: "Invalid code or password." };

  await db
    .update(users)
    .set({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null })
    .where(eq(users.id, session.userId));

  return { success: true };
}
