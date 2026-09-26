import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { AFT_LOGO_BASE64 } from "./aftLogo";

export type PrintableExam = { title: string; intro: string | null; totalDurationSeconds: number };
export type PrintableSection = { sectionNumber: number; title: string; durationSeconds: number; introduction: string | null; scenario?: string | null; question?: string | null; email?: PrintableEmail | null; attachmentTitles?: string[] };
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

const WIN_ANSI_ADDITIONAL_CODE_POINTS = new Set([
  0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017d, 0x017e, 0x0192, 0x02c6, 0x02dc,
  0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e,
  0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122,
]);

const DROP_CODE_POINTS = new Set([
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x202a, 0x202b, 0x202c,
  0x202d, 0x202e, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x2066, 0x2067, 0x2068,
  0x2069, 0xfeff,
]);

const SYMBOL_REPLACEMENTS = new Map<string, string>([
  ["●", "•"], ["◕", "•"], ["◉", "•"], ["○", "•"], ["◦", "•"], ["▪", "•"], ["▫", "•"],
  ["◆", "•"], ["◇", "•"], ["⁃", "•"], ["∙", "•"], ["⋅", "•"], ["⦁", "•"], ["⦂", "•"],
  ["◘", "@"], ["◙", "O"], ["◯", "O"], ["◎", "O"], ["⊚", "O"], ["☰", "="], ["☐", "[ ]"],
  ["→", "->"], ["⟶", "->"], ["⇒", "->"], ["⇛", "->"], ["⟹", "->"], ["➔", "->"], ["➜", "->"],
  ["↪", "->"], ["↳", "->"], ["↷", "->"], ["↗", "->"], ["↘", "->"], ["⇥", "->"], ["⇤", "|>"],
  ["←", "<-"], ["⟵", "<-"], ["⇐", "<-"], ["⟸", "<-"], ["↩", "<-"], ["↲", "<-"], ["↶", "<-"],
  ["↖", "<-"], ["↙", "<-"], ["⇦", "<-"], ["↞", "<-"], ["⌫", "<-"], ["⌦", "<-"],
  ["↔", "<->"], ["⇔", "<->"], ["⟷", "<->"], ["↕", "|^|"], ["↑", "^"], ["↓", "v"], ["↺", "c"], ["↻", "c"],
  ["−", "-"], ["‐", "-"], ["‑", "-"], ["‒", "-"], ["―", "-"], ["‾", "-"], ["﹘", "-"], ["﹣", "-"],
  ["≤", "<="], ["≥", ">="], ["≠", "!="], ["≈", "~"], ["∼", "~"], ["≅", "~"], ["≡", "=="], ["≜", "=="],
  ["√", "sqrt"], ["∛", "cbrt"], ["∞", "inf"], ["∝", "~"], ["∂", "d"], ["∆", "-"], ["∇", "-"],
  ["∑", "Sum"], ["∏", "Prod"], ["∫", "Int"], ["∬", "Int"], ["∭", "Int"], ["π", "pi"],
  ["μ", "u"], ["∕", "/"], ["⁄", "/"], ["‰", "%"], ["‱", "%"], ["′", "'"], ["″", "\""],
  ["№", "No."], ["❮", "<"], ["❯", ">"],
  ["⅓", "1/3"], ["⅔", "2/3"], ["⅕", "1/5"], ["⅖", "2/5"], ["⅗", "3/5"], ["⅘", "4/5"],
  ["⅙", "1/6"], ["⅚", "5/6"], ["⅛", "1/8"], ["⅜", "3/8"], ["⅝", "5/8"], ["⅞", "7/8"],
  ["✓", "Yes"], ["✔", "Yes"], ["☑", "Yes"], ["✗", "No"], ["✘", "No"], ["✕", "No"], ["☒", "No"], ["⊗", "No"],
  ["⚑", "Flag"], ["⚐", "Flag"], ["⚠", "!"], ["⚡", ""], ["⚙", "*"], ["⚛", "*"],
  ["✂", ""], ["✇", "*"], ["✈", ""], ["✉", ""], ["☎", ""], ["✆", ""],
  ["✎", "*"], ["✍", "*"], ["✏", "*"], ["✐", "*"], ["✑", "*"], ["✒", "*"],
  ["⌘", "Cmd"], ["⌥", "Alt"], ["⇧", "Shift"], ["⎋", "Esc"], ["⏎", ""],
  ["‥", ".."], ["⋯", "..."], ["⁞", "?"], ["⁝", "!"], ["⁚", ".."], ["⁛", "..."],
  ["¦", "|"], ["▌", "|"], ["▐", "|"], ["█", "#"], ["▓", "#"], ["▒", "+"], ["░", "-"], ["▀", "-"], ["▄", "-"],
  ["─", "-"], ["━", "-"], ["┄", "-"], ["┅", "-"], ["┈", "-"], ["┉", "-"], ["╌", "-"], ["╍", "-"],
  ["│", "|"], ["┃", "|"], ["┆", "|"], ["┇", "|"], ["┊", "|"], ["┋", "|"], ["╎", "|"], ["╏", "|"], ["║", "||"],
  ["═", "="], ["┌", "+"], ["┐", "+"], ["└", "+"], ["┘", "+"], ["├", "+"], ["┤", "+"], ["┬", "+"],
  ["┴", "+"], ["┼", "+"], ["╔", "+"], ["╗", "+"], ["╚", "+"], ["╝", "+"], ["╠", "+"], ["╣", "+"],
  ["╦", "+"], ["╩", "+"], ["╬", "+"], ["╭", "+"], ["╮", "+"], ["╯", "+"], ["╰", "+"],
  ["╱", "/"], ["╲", "\\"], ["╳", "x"], ["▚", "#"], ["▞", "#"], ["▙", "#"], ["▛", "#"], ["▜", "#"], ["▟", "#"],
]);

function isWinAnsiEncodable(codePoint: number) {
  return (codePoint >= 0x20 && codePoint <= 0x7e) || (codePoint >= 0xa0 && codePoint <= 0xff) || WIN_ANSI_ADDITIONAL_CODE_POINTS.has(codePoint);
}

function toWinAnsi(text: string | null | undefined) {
  if (!text) return "";
  let result = "";
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (DROP_CODE_POINTS.has(codePoint)) continue;
    if (codePoint === 0x00a0 || codePoint === 0x2007 || codePoint === 0x202f || codePoint === 0x3000) {
      result += " ";
      continue;
    }
    if (isWinAnsiEncodable(codePoint)) {
      result += character;
      continue;
    }
    result += SYMBOL_REPLACEMENTS.get(character) ?? "";
  }
  return result;
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
  const line = (raw: string, font: PDFFont = regular, size = 10, color = violet, indent = 48) => {
    const text = toWinAnsi(raw);
    const words = text.split(/\s+/).filter(Boolean); let current = "";
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
  const sectionBanner = (rawTitle: string, rawNote?: string) => {
    const title = toWinAnsi(rawTitle);
    const note = rawNote ? toWinAnsi(rawNote) : rawNote;
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
    if (section.scenario?.trim()) { y -= 2; line("Extra notes", bold, 10, mint); paragraph(section.scenario, regular, 10, violet); }
    if (section.question?.trim()) { y -= 2; line("Task question", bold, 10, mint); paragraph(section.question, regular, 10, violet); }
    const sectionEmail = section.email && (section.email.from || section.email.to || section.email.subject || section.email.html) ? section.email : null;
    if (sectionEmail) {
      y -= 2;
      line("Task email", bold, 10, mint);
      if (sectionEmail.from) line(`From: ${sectionEmail.from}`, regular, 10, violet);
      if (sectionEmail.to) line(`To: ${sectionEmail.to}`, regular, 10, violet);
      if (sectionEmail.subject) line(`Subject: ${sectionEmail.subject}`, regular, 10, violet);
      const emailBody = htmlToText(sectionEmail.html);
      if (emailBody) {
        y -= 2;
        for (const segment of emailBody.split("\n")) {
          paragraph(segment, regular, 10, violet);
          y -= 2;
        }
      }
    }
    if (section.attachmentTitles?.length) {
      y -= 2;
      line("Attachments", bold, 10, mint);
      for (const attachmentTitle of section.attachmentTitles) {
        ensureSpace(60);
        page.drawCircle({ x: 54, y: y + 3.5, size: 2.4, color: cyan });
        line(attachmentTitle, regular, 10, violet, 64);
      }
    }
    y -= 8;
  }

  ensureSpace(120);
  line("Candidate notes", bold, 12, violet);
  line("Write your responses in the online answer pad or on the printed answer pages supplied with this document. Keep your work secure and follow the exam administrator's submission instructions.", regular, 10);
  for (let i = 0; i < 3; i++) { if (y < 90) addPage(); page.drawLine({ start: { x: 48, y }, end: { x: pageWidth - 48, y }, thickness: 0.5, color: rgb(0.82, 0.82, 0.88) }); y -= 30; }
  return Buffer.from(await document.save());
}