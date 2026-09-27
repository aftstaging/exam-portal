import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { AFT_LOGO_BASE64 } from "./aftLogo";

export type PrintableExam = { title: string; intro: string | null; totalDurationSeconds: number };
export type PrintableSection = { sectionNumber: number; title: string; durationSeconds: number; introduction: string | null; scenario?: string | null; question?: string | null; email?: PrintableEmail | null; attachmentTitles?: string[] };
export type PrintableEmail = { from?: string | null; to?: string | null; subject?: string | null; html?: string | null };
export type PrintableAttachment = { kind: string; title: string };

/** A contiguous stretch of text that shares one emphasis state. */
type RichRun = { text: string; bold: boolean };

/**
 * One renderable block. `marker` is the bullet/number to draw in the hanging indent, or
 * `null` for a plain paragraph. `depth` is the list nesting level (0 = top level).
 */
type RichBlock = { marker: string | null; depth: number; runs: RichRun[] };

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", "#160": " ", hellip: "...",
  mdash: "-", ndash: "-", lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', bull: "\u2022", middot: "\u00b7",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    const key = entity.toLowerCase();
    if (NAMED_ENTITIES[key] !== undefined) return NAMED_ENTITIES[key];
    const codePoint = key.startsWith("#x")
      ? Number.parseInt(key.slice(2), 16)
      : key.startsWith("#")
        ? Number.parseInt(key.slice(1), 10)
        : Number.NaN;
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return match;
    }
  });
}

/**
 * Collapses the collected text parts into whitespace-normalised runs, merging neighbours
 * that share an emphasis state. Whitespace is dropped between runs so wrapping can be
 * re-derived at draw time, and adjacent words with equal emphasis are rejoined.
 */
function partsToRuns(parts: { text: string; bold: boolean }[]): RichRun[] {
  let flat = "";
  const boldMask: boolean[] = [];
  for (const part of parts) {
    for (const character of part.text) {
      flat += character;
      boldMask.push(part.bold);
    }
  }

  const runs: RichRun[] = [];
  let index = 0;
  // Tracks whether a whitespace run preceded the current token, so a continuation inside a
  // single word is rejoined without a space while a genuinely new word gets one.
  let afterSpace = true;
  while (index < flat.length) {
    if (/\s/.test(flat[index])) {
      while (index < flat.length && /\s/.test(flat[index])) index += 1;
      afterSpace = true;
      continue;
    }
    const bold = boldMask[index];
    let word = "";
    // Emphasis can start or end mid-token (e.g. `total<b>cost</b>ing`), so the token is cut
    // at every emphasis boundary rather than assuming one emphasis state per word.
    while (index < flat.length && !/\s/.test(flat[index]) && boldMask[index] === bold) {
      word += flat[index];
      index += 1;
    }
    const previous = runs[runs.length - 1];
    if (previous && previous.bold === bold) previous.text += `${afterSpace ? " " : ""}${word}`;
    else runs.push({ text: word, bold });
    afterSpace = false;
  }
  return runs;
}

/**
 * Parses author-supplied email HTML into renderable blocks, preserving the structure that a
 * naive tag strip destroys: bullet/numbered lists (with nesting depth) and inline emphasis.
 *
 * The previous implementation flattened everything to plain text, so bold sub-task markers
 * and bullet lists were dropped from the printable paper. PDFKit/pdfs only embed the regular
 * and bold faces here, so italic and underline runs render in the regular face.
 */
export function parseRichHtml(html: string | null | undefined): RichBlock[] {
  if (!html) return [];
  const source = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const blocks: RichBlock[] = [];
  let parts: { text: string; bold: boolean }[] = [];
  let boldDepth = 0;
  let listDepth = 0;
  const orderedStack: boolean[] = [];
  const counters: number[] = [];
  let pendingMarker: string | null = null;

  const flush = (marker: string | null, depth: number) => {
    const runs = partsToRuns(parts);
    parts = [];
    if (runs.length) blocks.push({ marker, depth, runs });
  };

  const tagPattern = /<(\/)?([a-z][a-z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*)>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source))) {
    if (match.index > cursor) {
      parts.push({ text: decodeEntities(source.slice(cursor, match.index)), bold: boldDepth > 0 });
    }
    cursor = match.index + match[0].length;

    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const attributes = match[3] ?? "";
    const selfClosing = /\/\s*$/.test(attributes);

    switch (tag) {
      case "strong":
      case "b":
        if (!selfClosing) boldDepth = Math.max(0, boldDepth + (closing ? -1 : 1));
        break;
      case "br":
        flush(pendingMarker, listDepth);
        break;
      case "p":
      case "div":
      case "blockquote":
      case "tr":
      case "table":
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        if (!selfClosing && closing) flush(pendingMarker, listDepth);
        break;
      case "ul":
      case "ol":
        if (selfClosing) break;
        if (closing) {
          flush(pendingMarker, listDepth);
          pendingMarker = null;
          listDepth = Math.max(0, listDepth - 1);
          orderedStack.pop();
          counters.pop();
        } else {
          listDepth += 1;
          orderedStack.push(tag === "ol");
          counters.push(0);
        }
        break;
      case "li":
        if (selfClosing) break;
        if (closing) {
          flush(pendingMarker, listDepth);
          pendingMarker = null;
        } else {
          flush(pendingMarker, listDepth);
          const level = Math.max(0, listDepth - 1);
          if (orderedStack[level]) {
            counters[level] = (counters[level] ?? 0) + 1;
            pendingMarker = `${counters[level]}.`;
          } else {
            pendingMarker = listDepth > 0 ? "\u2022" : null;
          }
        }
        break;
      default:
        break;
    }
  }
  if (cursor < source.length) parts.push({ text: decodeEntities(source.slice(cursor)), bold: boldDepth > 0 });
  flush(pendingMarker, listDepth);
  return blocks;
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
  const LIST_INDENT_STEP = 16;
  const MAX_LIST_DEPTH = 3;
  const LIST_MARKER_GAP = 14;
  /**
   * Draws a block's runs with per-run font selection, so bold sub-task markers keep their
   * emphasis, and wraps them inside a hanging indent when the block carries a bullet marker.
   */
  const richLine = (runs: RichRun[], indent: number, size: number, color: ReturnType<typeof rgb>, marker?: string) => {
    const fontFor = (isBold: boolean) => (isBold ? bold : regular);
    const rightEdge = pageWidth - 48;
    let pending: RichRun[] = [];
    let pendingWidth = 0;
    let markerPending = marker ? toWinAnsi(marker) : "";

    const flushLine = () => {
      if (!pending.length) return;
      ensureSpace(60);
      if (markerPending) {
        // Bullet sits in the gutter so wrapped lines align under the first word.
        page.drawText(markerPending, { x: indent - LIST_MARKER_GAP, y, size, font: regular, color });
        markerPending = "";
      }
      let cursorX = indent;
      // Merge neighbouring words that share a face so each styled stretch is a single draw
      // operation, which keeps the content stream small on long papers.
      let active: RichRun | null = null;
      const emit = () => {
        if (!active || !active.text) return;
        const font = fontFor(active.bold);
        page.drawText(active.text, { x: cursorX, y, size, font, color });
        cursorX += font.widthOfTextAtSize(active.text, size);
        active = null;
      };
      for (const run of pending) {
        if (active && active.bold === run.bold) {
          active.text += run.text;
          continue;
        }
        emit();
        active = { text: run.text, bold: run.bold };
      }
      emit();
      y -= size + 5;
      pending = [];
      pendingWidth = 0;
    };

    for (const run of runs) {
      const text = toWinAnsi(run.text);
      if (!text) continue;
      const font = fontFor(run.bold);
      for (const word of text.split(/\s+/).filter(Boolean)) {
        const spaceWidth = pending.length ? font.widthOfTextAtSize(" ", size) : 0;
        const wordWidth = font.widthOfTextAtSize(word, size);
        if (pending.length && indent + pendingWidth + spaceWidth + wordWidth > rightEdge) flushLine();
        if (pending.length) {
          const spacer = " ";
          pending.push({ text: spacer, bold: run.bold });
          pendingWidth += font.widthOfTextAtSize(spacer, size);
        }
        pending.push({ text: word, bold: run.bold });
        pendingWidth += wordWidth;
      }
    }
    flushLine();
  };
  /** Renders author-supplied email HTML with its lists and emphasis intact. */
  const richText = (html: string | null | undefined, size = 10, color = violet) => {
    for (const block of parseRichHtml(html)) {
      const depth = Math.min(Math.max(block.depth, 0), MAX_LIST_DEPTH);
      richLine(block.runs, 48 + depth * LIST_INDENT_STEP, size, color, block.marker ?? undefined);
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
    if (email.html) {
      y -= 4;
      richText(email.html);
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
      if (sectionEmail.html) {
        y -= 2;
        richText(sectionEmail.html);
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