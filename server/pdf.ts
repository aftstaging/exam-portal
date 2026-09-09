import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { AFT_LOGO_BASE64 } from "./aftLogo";

export type PrintableExam = { title: string; intro: string | null; totalDurationSeconds: number };
export type PrintableSection = { sectionNumber: number; title: string; durationSeconds: number; introduction: string | null; scenario?: string | null; question?: string | null };
export type PrintableEmail = { from?: string | null; to?: string | null; subject?: string | null; html?: string | null };
export type PrintableAttachment = { kind: string; title: string };

function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/\r\n?/g, "\n")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|table|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .join("\n");
}

export async function generateBrandedPrintablePdf(exam: PrintableExam, sections: PrintableSection[], context?: { email?: PrintableEmail | null; attachments?: PrintableAttachment[] }) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  let page = document.addPage([pageWidth, pageHeight]);
  let y = 790;
  const violet = rgb(0.047, 0.02, 0.141);
  const cyan = rgb(0, 0.72, 0.85);
  const mint = rgb(0, 0.78, 0.45);
  const slate = rgb(0.32, 0.3, 0.42);
  const addPage = () => { page = document.addPage([pageWidth, pageHeight]); y = 790; };
  const ensureSpace = (needed: number) => { if (y < needed) addPage(); };
  const line = (text: string, font: PDFFont = regular, size = 10, color = violet, indent = 48) => {
    const words = text.split(/\s+/); let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > pageWidth - indent - 48) { ensureSpace(60); page.drawText(current, { x: indent, y, size, font, color }); y -= size + 5; current = word; } else current = next;
    }
    if (current) { ensureSpace(60); page.drawText(current, { x: indent, y, size, font, color }); y -= size + 5; }
  };
  const paragraph = (text: string, font: PDFFont = regular, size = 10, color = violet, indent = 48) => {
    if (!text) return;
    for (const segment of text.split("\n")) {
      line(segment, font, size, color, indent);
      y -= 3;
    }
  };
  const sectionBanner = (title: string, note?: string) => {
    ensureSpace(90);
    page.drawRectangle({ x: 42, y: y - 8, width: pageWidth - 84, height: 28, color: violet });
    page.drawText(title, { x: 52, y: y, size: 10, font: bold, color: rgb(1, 1, 1) });
    if (note) page.drawText(note, { x: pageWidth - 52 - bold.widthOfTextAtSize(note, 9), y: y + 2, size: 9, font: bold, color: cyan });
    y -= 28;
  };

  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: 770, width: pageWidth, height: 72, color: violet });
  const logo = await document.embedPng(Buffer.from(AFT_LOGO_BASE64, "base64"));
  const scale = Math.min(120 / logo.width, 36 / logo.height);
  page.drawImage(logo, { x: pageWidth - 48 - logo.width * scale, y: 790, width: logo.width * scale, height: logo.height * scale });
  page.drawText("ACCOUNTANTS FOR TOMORROW", { x: 48, y: 808, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText("PRINTABLE MOCK EXAM", { x: 48, y: 787, size: 9, font: bold, color: cyan });
  y = 730;
  line(exam.title, bold, 20, violet);
  if (exam.intro?.trim()) { y -= 4; paragraph(exam.intro, regular, 10, slate); }
  line(`Total duration: ${Math.round(exam.totalDurationSeconds / 60)} minutes`, bold, 11, mint);
  y -= 10;
  line("AFT-created printable exam document generated from the exam record. Use the protected published question paper and permitted resources for the full assessment content.", regular, 10);
  const email = context?.email && (context.email.from || context.email.to || context.email.subject || context.email.html) ? context.email : null;
  const attachments = (context?.attachments ?? []).filter((attachment) => attachment?.title?.trim());
  line(`Interpretation of {exam} reflects every published field: {sections} timed section(s), and ${attachments.length ? `${attachments.length} attached document(s)` : "no additional attachments"}.`.replace("{exam}", exam.title).replace("{sections}", String(sections.length)), regular, 10, slate);
  y -= 10;

  if (email) {
    sectionBanner("DOCUMENT · EMAIL", email.subject ?? "Composed email");
    if (email.from) line(`From: ${email.from}`, bold, 10, violet);
    if (email.to) line(`To: ${email.to}`, bold, 10, violet);
    if (email.subject) line(`Subject: ${email.subject}`, bold, 10, violet);
    const body = htmlToText(email.html);
    if (body) {
      y -= 4;
      for (const segment of body.split("\n")) {
        paragraph(segment, regular, 10, violet);
        y -= 2;
      }
    }
    y -= 8;
  }

  if (attachments.length) {
    sectionBanner(`ATTACHED DOCUMENTS · ${attachments.length}`);
    for (const attachment of attachments) {
      ensureSpace(60);
      page.drawCircle({ x: 54, y: y + 3.5, size: 2.4, color: cyan });
      line(attachment.title, regular, 10, violet, 64);
    }
    y -= 8;
  }

  for (const section of sections) {
    if (!section?.title) continue;
    sectionBanner(`SECTION ${section.sectionNumber} · ${section.title}`, `${Math.round((section.durationSeconds ?? 0) / 60)} min`);
    paragraph(section.introduction ?? "Refer to the protected question paper for the complete case-study task and instructions.", regular, 10, violet);
    if (section.scenario?.trim()) { y -= 2; line("Scenario", bold, 10, mint); paragraph(section.scenario, regular, 10, violet); }
    if (section.question?.trim()) { y -= 2; line("Task question", bold, 10, mint); paragraph(section.question, regular, 10, violet); }
    y -= 8;
  }

  ensureSpace(120);
  line("Candidate notes", bold, 12, violet);
  line("Write your responses in the online answer pad or on the printed answer pages supplied with this document. Keep your work secure and follow the exam administrator's submission instructions.", regular, 10);
  for (let i = 0; i < 3; i++) { if (y < 90) addPage(); page.drawLine({ start: { x: 48, y }, end: { x: pageWidth - 48, y }, thickness: 0.5, color: rgb(0.82, 0.82, 0.88) }); y -= 30; }
  return Buffer.from(await document.save());
}