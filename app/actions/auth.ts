"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, verificationTokens, passwordResetTokens } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createSession,
  deleteSession,
  createEmailToken,
  createResetToken,
  verifyEmailToken,
  verifyResetToken,
} from "@/lib/auth";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";

const signUpSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

export async function signUp(formData: FormData): Promise<ActionResult> {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { firstName, lastName, email, password } = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({ firstName, lastName, email, passwordHash })
    .returning({ id: users.id });

  const token = await createEmailToken(user.id);

  await db.insert(verificationTokens).values({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  try {
    await sendVerificationEmail(email, token);
  } catch {
    // Email failure is non-fatal — user can request resend
  }

  return { success: true, message: "check-email" };
}

export async function signIn(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return { success: false, error: "Invalid email or password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { success: false, error: "Invalid email or password." };
  }

  if (!user.emailVerified) {
    return {
      success: false,
      error: "Please verify your email before signing in.",
    };
  }

  await createSession({ userId: user.id, email: user.email });
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  await deleteSession();
  redirect("/sign-in");
}

export async function verifyEmail(token: string): Promise<ActionResult> {
  const userId = await verifyEmailToken(token);
  if (!userId) {
    return { success: false, error: "Invalid or expired verification link." };
  }

  const [record] = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.token, token))
    .limit(1);

  if (!record || record.expiresAt < new Date()) {
    return { success: false, error: "This verification link has expired." };
  }

  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, userId));

  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.token, token));

  return { success: true };
}

export async function forgotPassword(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  if (!z.string().email().safeParse(email).success) {
    return { success: false, error: "Invalid email address." };
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always return success to avoid email enumeration
  if (!user) return { success: true };

  const token = await createResetToken(user.id);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  try {
    await sendPasswordResetEmail(email, token);
  } catch {
    // Non-fatal
  }

  return { success: true };
}

export async function resetPassword(
  token: string,
  formData: FormData
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const userId = await verifyResetToken(token);
  if (!userId) {
    return { success: false, error: "Invalid or expired reset link." };
  }

  const [record] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!record || record.used || record.expiresAt < new Date()) {
    return { success: false, error: "This reset link has expired or already been used." };
  }

  const passwordHash = await hashPassword(password);

  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.token, token));

  return { success: true };
}
