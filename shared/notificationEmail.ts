/**
 * Pure rendering for notification emails. Kept free of I/O so the copy and the escaping can be
 * unit-tested without an SMTP server.
 */

export type NotificationEmailInput = {
  recipientName?: string | null;
  subject: string;
  body: string;
  /** Root-relative in-app path, e.g. `/profile`. Turned into an absolute link when `origin` is set. */
  link?: string | null;
  origin?: string | null;
};

export type RenderedEmail = { subject: string; text: string; html: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Absolute link for a notification, or null when there is no in-app route to point at. */
export function notificationLink(link: string | null | undefined, origin: string | null | undefined): string | null {
  if (!link) return null;
  const path = link.startsWith("/") ? link : `/${link}`;
  if (!origin) return path;
  return `${origin.replace(/\/+$/, "")}${path}`;
}

export function renderNotificationEmail(input: NotificationEmailInput): RenderedEmail {
  const greeting = input.recipientName?.trim() ? `Hello ${input.recipientName.trim()},` : "Hello,";
  const href = notificationLink(input.link, input.origin);
  const bodyLines = input.body.split(/\r?\n/).map((line) => line.trimEnd());
  const textParts = [greeting, "", input.subject, "", ...bodyLines];
  if (href) textParts.push("", `Open the portal: ${href}`);
  textParts.push("", "Accountants for Tomorrow");

  const htmlBody = bodyLines
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1].length > 0))
    .map((line) => (line ? `<p style="margin:0 0 12px;line-height:1.6;color:#1f1438">${escapeHtml(line)}</p>` : ""))
    .join("");
  const button = href
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#00ff88;color:#0c0524;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open the portal</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f2fb;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f2fb;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#18093c;padding:20px 28px"><span style="color:#00e5ff;font-size:12px;letter-spacing:.14em;font-weight:700;text-transform:uppercase">Accountants for Tomorrow</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;color:#1f1438">${escapeHtml(greeting)}</p>
<h2 style="margin:0 0 16px;font-size:18px;color:#18093c">${escapeHtml(input.subject)}</h2>
${htmlBody}${button}
</td></tr>
<tr><td style="padding:16px 28px;background:#f8f7fc;color:#6b6480;font-size:12px">You are receiving this because you have an account on the AFT learning portal.</td></tr>
</table></td></tr></table></body></html>`;

  return { subject: input.subject, text: textParts.join("\n"), html };
}
