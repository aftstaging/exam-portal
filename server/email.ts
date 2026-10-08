import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound email over SMTP. Configuration comes from the environment so the same build works in
 * production and in environments with no mail server:
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ("true" for port 465), SMTP_USER, SMTP_PASS,
 *   SMTP_FROM (e.g. "AFT Learning Portal <no-reply@example.com>").
 * When SMTP_HOST or SMTP_FROM is missing, sending is skipped and reported as not delivered; the
 * in-app notification is still stored, so nothing is lost.
 */

export type OutboundEmail = { to: string; subject: string; text: string; html: string };

export type EmailSendResult = { delivered: boolean; reason?: string };

let transporter: Transporter | null = null;

export function isEmailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

function getTransporter(env: NodeJS.ProcessEnv = process.env): Transporter {
  if (transporter) return transporter;
  const port = Number(env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE === "true" || port === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } : undefined,
  });
  return transporter;
}

export async function sendEmail(message: OutboundEmail, env: NodeJS.ProcessEnv = process.env): Promise<EmailSendResult> {
  if (!isEmailConfigured(env)) return { delivered: false, reason: "SMTP is not configured" };
  if (!message.to) return { delivered: false, reason: "Recipient has no email address" };
  try {
    await getTransporter(env).sendMail({
      from: env.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { delivered: true };
  } catch (error) {
    console.warn("[email] delivery failed", error instanceof Error ? error.message : error);
    return { delivered: false, reason: error instanceof Error ? error.message : "send failed" };
  }
}
