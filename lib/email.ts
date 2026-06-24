import nodemailer from "nodemailer";
import React from "react";
import { render } from "@react-email/render";
import { VerifyEmail } from "@/emails/verify-email";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { WorkspaceInviteEmail } from "@/emails/workspace-invite";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const from = process.env.EMAIL_FROM ?? "Boardly <noreply@boardly.app>";

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const url = `${appUrl}/verify-email?token=${token}`;
  const html = await render(React.createElement(VerifyEmail, { url }));
  await transporter.sendMail({
    from,
    to,
    subject: "Verify your Boardly account",
    html,
  });
}

export async function sendWorkspaceInviteEmail(
  to: string,
  token: string,
  workspaceName: string,
  inviterName: string
): Promise<void> {
  const url = `${appUrl}/accept-invite?token=${token}`;
  const html = await render(
    React.createElement(WorkspaceInviteEmail, { url, workspaceName, inviterName })
  );
  await transporter.sendMail({
    from,
    to,
    subject: `${inviterName} invited you to ${workspaceName} on Boardly`,
    html,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<void> {
  const url = `${appUrl}/reset-password?token=${token}`;
  const html = await render(React.createElement(ResetPasswordEmail, { url }));
  await transporter.sendMail({
    from,
    to,
    subject: "Reset your Boardly password",
    html,
  });
}
