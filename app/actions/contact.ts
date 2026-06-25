"use server";

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

const from = process.env.EMAIL_FROM ?? "Boardly <noreply@boardly.app>";
const to = process.env.CONTACT_EMAIL ?? process.env.EMAIL_FROM ?? "hello@boardly.app";

export async function submitContactForm(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return { success: false, error: "All fields are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (message.length < 10) {
    return { success: false, error: "Message must be at least 10 characters." };
  }

  try {
    await transporter.sendMail({
      from,
      to,
      replyTo: `${name} <${email}>`,
      subject: `Boardly contact form — ${name}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <hr />
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });
    return { success: true };
  } catch (err) {
    console.error("Contact form email error:", err);
    return { success: false, error: "Failed to send your message. Please try again or email us directly." };
  }
}
