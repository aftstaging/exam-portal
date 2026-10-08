import { eq } from "drizzle-orm";
import { users, notifications } from "../drizzle/schema";
import { renderNotificationEmail } from "@shared/notificationEmail";
import { publishToUser } from "./_core/notificationStream";
import { sendEmail } from "./email";

export type NotificationType = "account" | "purchase" | "submission" | "marking" | "message" | "comment" | "profile" | "supervision";

export type NotifyInput = {
  userId: number;
  type: NotificationType;
  subject: string;
  body: string;
  link?: string | null;
};

/** The public origin used for links inside emails, from APP_PUBLIC_URL when configured. */
function publicOrigin(): string | null {
  return process.env.APP_PUBLIC_URL?.trim() || null;
}

/**
 * Stores a notification, pushes it to the user's open browser sessions in real time, and emails it.
 *
 * The row is written first and returned without waiting for the email, so an SMTP outage or a slow
 * mail server cannot delay the action that triggered the notification. The email outcome is written
 * back to `emailedAt` when it succeeds.
 */
export async function notifyUser(db: any, input: NotifyInput): Promise<{ id: number | null; emailQueued: boolean }> {
  const subject = input.subject.slice(0, 240);
  const link = input.link ?? null;
  const inserted = (await db.insert(notifications).values({ userId: input.userId, type: input.type, subject, body: input.body, link })) as unknown as { insertId?: number }[] | { insertId?: number };
  const insertId = Array.isArray(inserted) ? inserted[0]?.insertId : inserted?.insertId;
  const id = insertId ?? null;

  publishToUser(input.userId, "notification", { id, type: input.type, subject, body: input.body, link, createdAt: new Date().toISOString() });

  const [recipient] = await db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, input.userId)).limit(1);
  const emailQueued = Boolean(recipient?.email);
  if (emailQueued) {
    void deliverNotificationEmail(db, id, recipient!, subject, input.body, link);
  }
  return { id, emailQueued };
}

async function deliverNotificationEmail(db: any, notificationId: number | null, recipient: { email: string | null; name: string | null }, subject: string, body: string, link: string | null) {
  try {
    const rendered = renderNotificationEmail({ recipientName: recipient.name, subject, body, link, origin: publicOrigin() });
    const result = await sendEmail({ to: recipient.email!, subject: rendered.subject, text: rendered.text, html: rendered.html });
    if (result.delivered && notificationId != null) {
      await db.update(notifications).set({ emailedAt: new Date() }).where(eq(notifications.id, notificationId));
    }
  } catch (error) {
    console.warn("[notifications] email delivery error", error instanceof Error ? error.message : error);
  }
}
