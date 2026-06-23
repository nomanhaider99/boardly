import nodemailer from "nodemailer";

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
  await transporter.sendMail({
    from,
    to,
    subject: "Verify your Boardly account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#22c55e">Welcome to Boardly!</h2>
        <p>Click the button below to verify your email address. This link expires in 24 hours.</p>
        <a href="${url}" style="display:inline-block;background:#22c55e;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Verify Email
        </a>
        <p style="color:#888;font-size:13px">Or copy this link: ${url}</p>
      </div>
    `,
  });
}

export async function sendWorkspaceInviteEmail(
  to: string,
  token: string,
  workspaceName: string,
  inviterName: string
): Promise<void> {
  const url = `${appUrl}/accept-invite?token=${token}`;
  await transporter.sendMail({
    from,
    to,
    subject: `${inviterName} invited you to ${workspaceName} on Boardly`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#22c55e">You've been invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace on Boardly.</p>
        <a href="${url}" style="display:inline-block;background:#22c55e;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Accept Invite
        </a>
        <p style="color:#888;font-size:13px">This invite expires in 7 days. If you weren't expecting this, you can ignore it.</p>
        <p style="color:#888;font-size:13px">Or copy this link: ${url}</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<void> {
  const url = `${appUrl}/reset-password?token=${token}`;
  await transporter.sendMail({
    from,
    to,
    subject: "Reset your Boardly password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#22c55e">Reset your password</h2>
        <p>Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${url}" style="display:inline-block;background:#22c55e;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
