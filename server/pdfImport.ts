import "./_core/polyfills";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument } from "pdf-lib";
import { sanitizeAuthoredHtml } from "@shared/richText";

export type PdfFile = { fileName: string; mimeType: string; base64: string };

export type PdfTaskSection = {
  sectionNumber: number;
  title: string;
  introduction?: string;
  scenario?: string;
  question?: string;
  durationSeconds: number;
  // Per-task email brief, composed fields + rich-text HTML body reproduced from the paper.
  emailFrom?: string;
  emailTo?: string;
  emailSubject?: string;
  emailText?: string;
  // Reference-material pages for this task, carved out of the source PDF so tables and
  // layout survive exactly as printed.
  reference?: PdfFile | null;
};

export type PdfObjectiveQuestion = {
  topic: string;
  prompt: string;
  options: string[];
  correct: number;
  questionType: "single_choice" | "multiple_choice";
  explanation?: string;
  rationale?: string[];
};

export type PdfExamDraft = {
  fileName: string;
  // true when the uploaded file is a solutions / answers / marking-guide PDF (attached as feedback)
  isSolutionsDocument: boolean;
  title?: string;
  examType: "case_study" | "objective_test";
  intro?: string;
  description?: string;
  priceCents: number;
  accessDays: number;
  totalDurationSeconds: number;
  emailFrom?: string;
  emailTo?: string;
  emailSubject?: string;
  emailText?: string;
  preModeratedPdf?: PdfFile;
  preSeen?: PdfFile | null;
  formulae?: PdfFile | null;
  reference?: PdfFile | null;
  feedbackFile?: PdfFile | null;
  caseStudySections?: PdfTaskSection[];
  objectiveQuestions?: PdfObjectiveQuestion[];
  notes: string[];
};

/** One visual line of a PDF page, kept with its geometry so paragraphs and bullets survive. */
type TextLine = { text: string; x: number; y: number; height: number; page: number };

type PageText = { pageNumber: number; lines: TextLine[]; text: string };

const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF\u2060]/g;
const LIGATURE_MAP: Record<string, string> = {
  "\uFB00": "ff",
  "\uFB01": "fi",
  "\uFB02": "fl",
  "\uFB03": "ffi",
  "\uFB04": "ffl",
  "\uFB05": "st",
  "\uFB06": "st",
};

function stripDataUrl(base64: string): string {
  return base64.includes(",") ? base64.split(",")[1] ?? base64 : base64;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Removes PDF text-layer noise (zero-width marks, ligature glyphs, hard spaces) from one line. */
function normalizeText(value: string): string {
  return collapseWhitespace(
    value
      .replace(ZERO_WIDTH, "")
      .replace(/[\uFB00-\uFB06]/g, (ch) => LIGATURE_MAP[ch] ?? "")
      .replace(/\u00A0/g, " "),
  );
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Collapses a list of page numbers into compact ranges, e.g. `[2, 3, 4, 7]` =>
 * `"2–4, 7"`. Used to keep the "skipped pages" note readable on long papers.
 */
export function formatPageRanges(pages: number[]): string {
  const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (let index = 1; index <= sorted.length; index += 1) {
    const current = sorted[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = current;
    previous = current;
  }
  return ranges.join(", ");
}

/**
 * Recognisable running headers / footers that mock-exam publishers stamp on every
 * page (Kaplan, Astranti, CIMA brand lines). These tokens otherwise leak into the
 * first line of every page and would confuse heading detection. The list is data —
 * adding a new publisher's token here is all that is needed, the parser logic never
 * changes. Page footer numbers are left in place — harmless.
 */
export const RUNNING_HEADER_PATTERNS: RegExp[] = [
  /\bMO\s+CK\s+B\b/gi,
  /\bMOCK\s+EXAM\s+[A-Z0-9]+\b/gi,
  /\bCIMA\s+MANAGE\s+MENT\s+LEVEL\s+CASE\s+ST\s+UDY\b/gi, // letterspaced Kaplan running header
  /\bCIMA\s+MANAGEMENT\s+LEVEL\s+CASE\s+STUDY\b/gi, // plain form
  /\b(?:CIMA|ACCA)\s+STRATEGIC[-\s]*PROFESSIONAL\b/gi,
  /\bKAPLAN\s+(?:PUBLISHING|FINANCIAL|GROUP)\b/gi,
  /\bBPP\s+(?:LEARNING|UNIVERSITY)\b/gi,
  // The copyright footer must go before the bare brand pattern, or "Astranti" is
  // removed first and "© 2026 2" leaks into the page body.
  /©\s*(?:Astranti\s+)?\d{4}/gi,
  /\bASTRANTI\b/gi,
  /\bManagement\s+Case\s+Study\s+Mock\s+Exam\s+\d+\b/gi,
];

/**
 * Removes the running headers / footers listed in `RUNNING_HEADER_PATTERNS` from a
 * page of pdfjs output. Exported for unit coverage.
 */
export function stripRunningHeaders(text: string): string {
  let value = text;
  for (const pattern of RUNNING_HEADER_PATTERNS) value = value.replace(pattern, " ");
  return collapseWhitespace(value);
}

/**
 * Reads a PDF into visual lines using the text layer's geometry. pdfjs hands back one
 * glyph fragment per word chunk (sometimes per letter), so items are grouped into lines
 * by baseline `y` and rejoined by their `x` gaps: a zero-width gap glues a split word
 * ("F" + "rom:" → "From:"), a real gap keeps words apart even in justified text where
 * inter-word spacing stretches. Line breaks and paragraph gaps are what let the email
 * and reference parsers reproduce the document's own formatting.
 */
async function extractPageTexts(pdfData: Uint8Array): Promise<PageText[]> {
  const doc = await getDocument({ data: pdfData, useSystemFonts: true }).promise;
  const pages: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    type Fragment = { str: string; x: number; y: number; w: number; h: number };
    const fragments: Fragment[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = item.str;
      if (!str || !str.trim()) continue;
      fragments.push({
        str,
        x: item.transform[4] ?? 0,
        y: item.transform[5] ?? 0,
        w: item.width,
        h: item.height || Math.abs(item.transform[3] ?? 0) || 10,
      });
    }
    // Strict y-descending order keeps the comparator transitive; near-equal baselines
    // are merged in the run pass below.
    fragments.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const runs: Fragment[][] = [];
    for (const fragment of fragments) {
      const run = runs[runs.length - 1];
      if (run && Math.abs((run[0]!.y) - fragment.y) <= 4) run.push(fragment);
      else runs.push([fragment]);
    }
    const lines: TextLine[] = [];
    for (const run of runs) {
      run.sort((a, b) => a.x - b.x);
      let text = run[0]!.str;
      let right = run[0]!.x + run[0]!.w;
      let height = run[0]!.h;
      for (const fragment of run.slice(1)) {
        text += fragment.x - right > 0.8 ? ` ${fragment.str}` : fragment.str;
        right = Math.max(right, fragment.x + fragment.w);
        height = Math.max(height, fragment.h);
      }
      const cleaned = stripRunningHeaders(normalizeText(text));
      // A line that strips down to a lone page number carries no content.
      if (!cleaned || /^[\d\s.,\-–—]+$/.test(cleaned)) continue;
      lines.push({ text: cleaned, x: run[0]!.x, y: run[0]!.y, height, page: i });
    }
    pages.push({ pageNumber: i, lines, text: lines.map((line) => line.text).join("\n") });
  }
  return pages;
}

/**
 * The cover page is re-extracted from the raw pdfjs output because the running-header
 * strip removes the exam name from page one (e.g. "Mock Exam 3", "MOCK EXAM B"), and
 * indexing into the whitespace-collapsed string yields a different sequence than the
 * stripped page, so we can't reverse-strip.
 */
async function extractCoverText(pdfData: Uint8Array): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(pdfData), useSystemFonts: true }).promise;
  if (doc.numPages < 1) return "";
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
}

/**
 * Header scan that works on a single (whitespace-collapsed) line of text, which is
 * how pdfjs returns each page: it finds each From:/To:/Subject:/Cc:/Date: field and
 * slices the text up to the next recognised header name.
 */
function extractEmailHeader(text: string): { from?: string; to?: string; subject?: string; cc?: string; date?: string } {
  const names = ["From", "To", "Cc", "Subject", "Date"] as const;
  const positions = names
    .map((name) => {
      const index = text.indexOf(`${name}:`);
      return { name, index };
    })
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index);
  const result: Record<string, string> = {};
  positions.forEach((current, index) => {
    const next = positions[index + 1];
    const end = next ? next.index : text.length;
    const value = text.slice(current.index + current.name.length + 1, end).trim();
    result[current.name.toLowerCase()] = value.length > 160 ? value.slice(0, 160) : value;
  });
  return result;
}

/* ------------------------------------------------------------------ *
 * Email extraction
 * ------------------------------------------------------------------ */

/**
 * `From:` etc. at the start of a line, tolerating the occasional PDF text layer that
 * drops the first letter onto its own fragment ("F rom:" → "From:").
 */
const EMAIL_LINE = /^\s*(?:[A-Za-z]\s+)?(?:from|to|cc|bcc|subject|date)\s*:/i;

function isEmailHeaderLine(text: string): boolean {
  return EMAIL_LINE.test(text);
}

/** Repairs a split header label before the header scan ("F rom:" → "From:"). */
function repairHeaderLine(text: string): string {
  return text.replace(/^(\s*)([A-Za-z])\s+(?=(?:from|to|cc|bcc|subject|date)\s*:)/i, "$1$2");
}

/** True for the start of an email's header block: a line carrying From: or Subject:. */
function startsEmailBlock(text: string): boolean {
  if (!isEmailHeaderLine(text)) return false;
  const repaired = repairHeaderLine(text);
  return /\bfrom\s*:/i.test(repaired) || /\bsubject\s*:/i.test(repaired);
}

/**
 * Finds the first email header block in a task's lines. The block starts at its first
 * header line — which may be `To:` when the paper prints the recipient above the
 * sender — and counts as an email when the run carries From: or Subject:.
 */
function findEmailStart(lines: TextLine[]): number {
  for (let index = 0; index < lines.length; index += 1) {
    if (!isEmailHeaderLine(lines[index]!.text)) continue;
    let runEnd = index;
    let multi = false;
    while (runEnd < lines.length && isEmailHeaderLine(lines[runEnd]!.text)) {
      const text = repairHeaderLine(lines[runEnd]!.text);
      if (((text.match(/\b(?:from|to|cc|subject|date)\s*:/gi) ?? []).length) >= 2) multi = true;
      runEnd += 1;
    }
    const block = lines.slice(index, runEnd).map((line) => repairHeaderLine(line.text)).join(" ");
    if (multi || /\bfrom\s*:/i.test(block) || /\bsubject\s*:/i.test(block)) return index;
    index = runEnd - 1;
  }
  return -1;
}

/**
 * Parses the header block at `start` and returns where the body begins. Handles both
 * one header per line and several headers sharing a line.
 */
function parseEmailAt(lines: TextLine[], start: number): { from?: string; to?: string; subject?: string; bodyStart: number } {
  const first = repairHeaderLine(lines[start]!.text);
  const headerCount = (first.match(/\b(?:from|to|cc|subject|date)\s*:/gi) ?? []).length;
  if (headerCount >= 2) {
    const parsed = extractEmailHeader(first);
    return { from: parsed.from, to: parsed.to, subject: parsed.subject, bodyStart: start + 1 };
  }
  const fields: Record<string, string> = {};
  let index = start;
  while (index < lines.length && isEmailHeaderLine(lines[index]!.text)) {
    const parsed = extractEmailHeader(repairHeaderLine(lines[index]!.text));
    if (parsed.from) fields.from = parsed.from;
    if (parsed.to) fields.to = parsed.to;
    if (parsed.cc) fields.cc = parsed.cc;
    if (parsed.subject) fields.subject = parsed.subject;
    if (parsed.date) fields.date = parsed.date;
    index += 1;
  }
  return { from: fields.from, to: fields.to, subject: fields.subject, bodyStart: index };
}

const SIGN_OFF_LINE = /^(?:kind regards|best regards|warm regards|regards|yours sincerely|yours faithfully|yours truly|thanks|thank you|cheers)\b/i;
const BULLET_LINE = /^\s*[●•▪‣◦]\s*/;
/** Kaplan-style papers bullet with a dash; require a capital so hyphenated prose isn't caught. */
const DASH_BULLET_LINE = /^\s*[-–—]\s+(?=[A-Z(“"])/;
const BRACKET_NOTE = /^\s*\[[^\]]{1,100}\]\s*$/;

/**
 * Cuts the email body from `start` up to the sign-off (kept, with the sender's name) or
 * the end of the block. A second header block or a nested email ends the body.
 */
function sliceEmailBody(lines: TextLine[], start: number): TextLine[] {
  const out: TextLine[] = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (out.length && startsEmailBlock(line.text)) break;
    out.push(line);
    if (SIGN_OFF_LINE.test(line.text)) {
      let extra = 0;
      while (
        extra < 2 &&
        index + 1 < lines.length &&
        lines[index + 1]!.text.length <= 60 &&
        !SIGN_OFF_LINE.test(lines[index + 1]!.text) &&
        !startsEmailBlock(lines[index + 1]!.text)
      ) {
        out.push(lines[++index]!);
        extra += 1;
      }
      break;
    }
  }
  return out;
}

/**
 * Rebuilds visual lines as authored HTML: paragraphs for text runs, `<ul>` lists for
 * the `●` bullets, `[sub-task …]` notes kept under their bullet. Paragraph breaks use
 * the vertical gaps the paper printed (a blank line between paragraphs is a larger
 * baseline jump than ordinary line spacing), so the message reads exactly the way it
 * is laid out on the page instead of one collapsed blob of sentences.
 */
export function linesToHtml(lines: TextLine[]): string {
  if (!lines.length) return "";
  const gaps: number[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const prev = lines[index - 1]!;
    const current = lines[index]!;
    if (current.page !== prev.page) continue;
    const gap = prev.y - current.y;
    if (gap > 0.5) gaps.push(gap);
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  // Ordinary line spacing is the tight quarter of the gaps; paragraph gaps are the
  // outliers above it. A median would drift upwards on a page that is mostly
  // short paragraphs and then fail to split anything.
  const linePitch = sorted.length ? sorted[Math.floor(sorted.length * 0.25)]! : 13;

  const out: string[] = [];
  const list: string[] = [];
  let para: string[] | null = null;
  let li: string[] | null = null;

  const closePara = () => {
    if (para) {
      out.push(`<p>${para.join("")}</p>`);
      para = null;
    }
  };
  const closeLi = () => {
    if (li) {
      list.push(`<li>${li.join("")}</li>`);
      li = null;
    }
  };
  const closeList = () => {
    closeLi();
    if (list.length) {
      out.push(`<ul>${list.join("")}</ul>`);
      list.length = 0;
    }
  };

  let prevRaw = "";
  let prevPage = -1;
  let prevY = 0;
  for (const line of lines) {
    const text = escapeHtml(line.text.replace(BULLET_LINE, "").replace(DASH_BULLET_LINE, "").trim());
    const isBullet = BULLET_LINE.test(line.text) || DASH_BULLET_LINE.test(line.text);
    const isBracket = BRACKET_NOTE.test(line.text);
    if (!text) continue;
    const pageBreak = prevPage !== -1 && line.page !== prevPage;
    const gap = !pageBreak ? prevY - line.y : 0;
    const pitch = Math.max(1.55 * (line.height || 10), 1.38 * linePitch);
    const bigBreak = prevPage !== -1 && (pageBreak || gap > pitch);
    const signOffJoin = prevPage !== -1 && SIGN_OFF_LINE.test(prevRaw);

    // A sign-off always ends the message: it closes any bullet list and opens its
    // own paragraph, so "Kind regards," / "Elizabeth" reads as the closing block.
    if (SIGN_OFF_LINE.test(line.text)) {
      closeList();
      closePara();
      para = [text];
      prevRaw = line.text;
      prevPage = line.page;
      prevY = line.y;
      continue;
    }
    if (isBullet) {
      closePara();
      closeLi();
      li = [text];
      prevRaw = line.text;
      prevPage = line.page;
      prevY = line.y;
      continue;
    }
    if (isBracket) {
      const target = li ?? (para ??= []);
      target.push(`<br />${text}`);
      prevRaw = line.text;
      prevPage = line.page;
      prevY = line.y;
      continue;
    }
    if (li) {
      if (bigBreak) {
        closeList();
        para = [text];
      } else {
        li.push(`${signOffJoin ? "<br />" : " "}${text}`);
      }
    } else if (para) {
      if (bigBreak && !signOffJoin) {
        closePara();
        para = [text];
      } else {
        para.push(`${signOffJoin ? "<br />" : " "}${text}`);
      }
    } else {
      para = [text];
    }
    prevRaw = line.text;
    prevPage = line.page;
    prevY = line.y;
  }
  closePara();
  closeList();
  return sanitizeAuthoredHtml(out.join(""));
}

function detectSolutionsDocument(fileName: string, pages: PageText[]): boolean {
  // Normalise separators so \b word boundaries work ("mock_exam" → "mock exam").
  const base = fileName.replace(/\.[a-z0-9]+$/i, "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  // The filename is the most reliable signal, so trust it before scanning the
  // pages. A question paper's cover often says that suggested answers or a
  // marking guide are provided separately — that must not reclassify the whole
  // paper as a solutions document.
  if (/\b(solutions?|answers?|marking guide|suggested answers?|debrief)\b/.test(base)) return true;
  if (/\b(?:questions?|papers?)\b/.test(base) || /\bmock exam\b/.test(base)) return false;
  const sample = pages.slice(0, Math.min(2, pages.length)).map((page) => page.text.toLowerCase()).join(" ");
  return /\b(suggested solutions|marking guide|suggested answers|answers and marking|do not refer to these answers|perfect answer)\b/.test(sample);
}

function detectObjectiveTest(coverText: string, allText: string): boolean {
  if (/\bobjective\s+test\b/i.test(allText)) return true;
  // A few "answer screens" phrases in case-study covers must not trip MCQs.
  if (/\bTask\s+\d+\b/i.test(allText) || /\bcases?\s+stud\b/i.test(allText) || /\bcases?\s+study\b/i.test(allText)) return false;
  const optionLetterRuns = (allText.match(/(?:^|\s)(?:[A-E][).:]\s)/g) ?? []).length;
  return optionLetterRuns >= 8;
}

function extractCoverTitle(coverText: string, fileName: string): string | null {
  const text = coverText;
  const astranti = text.match(/Mock\s+Exam\s+(\d+)/i);
  if (astranti) {
    const cartn = /\bCartn\b/i.test(text);
    return `${cartn ? "Cartn" : "CIMA"} Mock Exam ${astranti[1]}`;
  }
  const kaplan = text.match(/\bMOCK\s+EXAM\s+([A-Z0-9]+)/i);
  if (kaplan) {
    const period = text.match(/((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*&\s*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{4})/i);
    const letter = kaplan[1].toUpperCase();
    return period ? `Mock Exam ${letter} — ${period[1]}` : `Mock Exam ${letter}`;
  }
  const base = fileName.replace(/\.[a-z0-9]+$/i, "");
  if (base) {
    return base
      .replace(/[-_]+/g, " ")
      .replace(/\b(?:questions?|solutions?|answers?|marking[- ]guide|paper)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim() || null;
  }
  return null;
}

/**
 * Carves the pages listed in `pageNumbers` (1-based) out of the source PDF into a
 * standalone PDF file, ready to be saved as a protected resource.
 */
async function carvePdf(pdfData: Uint8Array, pageNumbers: number[], baseName: string, suffix: string): Promise<PdfFile | null> {
  if (!pageNumbers.length) return null;
  const source = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const output = await PDFDocument.create();
  const indices = Array.from(new Set(pageNumbers)).map((page) => page - 1).filter((page) => page >= 0 && page < source.getPageCount());
  const copied = await output.copyPages(source, indices);
  copied.forEach((page) => output.addPage(page));
  const bytes = await output.save();
  return {
    fileName: `${baseName}${suffix}.pdf`,
    mimeType: "application/pdf",
    base64: Buffer.from(bytes).toString("base64"),
  };
}

const TASK_HEADING_ASTRANTI = /Task\s+(\d+)\s*[-–—]?\s*([^\[\]]*?)\s*\[\s*(\d+)\s*minutes?\s*\]/i;
const TASK_HEADING_KAPLAN = /\bTASK\s+(\d+)\s*\(\s*(\d+)\s*minutes?\s*\)/i;

function matchTaskHeading(text: string): { number: number; title: string; minutes: number; headingEnd: number } | null {
  const astranti = TASK_HEADING_ASTRANTI.exec(text);
  if (astranti && astranti[0] && astranti.index >= 0) {
    return {
      number: Number(astranti[1]),
      title: (astranti[2] || "").trim().replace(/\s+/g, " "),
      minutes: Number(astranti[3]),
      headingEnd: astranti.index + astranti[0].length,
    };
  }
  const kaplan = TASK_HEADING_KAPLAN.exec(text);
  if (kaplan && kaplan[0] && kaplan.index >= 0) {
    return {
      number: Number(kaplan[1]),
      title: "",
      minutes: Number(kaplan[2]),
      headingEnd: kaplan.index + kaplan[0].length,
    };
  }
  return null;
}

function looksLikeReference(pageText: string): boolean {
  return (
    /\breference\s+material\b/i.test(pageText) ||
    /\bit is provided as reference material\b/i.test(pageText) ||
    /\bextract\s+from\b/i.test(pageText) ||
    /\bboard\s+minutes?\b/i.test(pageText) ||
    /\bannual\s+report\b/i.test(pageText) ||
    /\bsegmental\s+analysis\b/i.test(pageText) ||
    /\binternal\s+briefing\s+note\b/i.test(pageText) ||
    /\bnews\s+article\b/i.test(pageText) ||
    /\bfinancing\s+options\b/i.test(pageText)
  );
}

/**
 * Pre-seen / advance-information pages are the case brief the candidate studies
 * before the exam. When the uploaded paper contains such a section it is carved
 * into a protected `pre_seen` attachment; otherwise the slot stays empty and is
 * filled manually in the studio.
 */
function looksLikePreSeen(pageText: string): boolean {
  return (
    /\bpre-?seen\b/i.test(pageText) ||
    /\badvance\s+information\b/i.test(pageText) ||
    /\bmaterial\s+you\s+(?:have\s+)?received\b/i.test(pageText) ||
    /\bbackground\s+(?:information|material)\s+(?:about|on|for)\b/i.test(pageText) ||
    /\bthis\s+is\s+the\s+pre-seen\b/i.test(pageText)
  );
}

function looksLikeFormulae(pageText: string): boolean {
  return (
    /\bFORMULAE\s+AND\s+[T]ABLES\b/i.test(pageText) ||
    /\b(?:present\s+value\s+tables?|cumulative\s+present\s+value)/i.test(pageText) ||
    /\bannuity\b/i.test(pageText) ||
    /\bperpetuity\b/i.test(pageText) ||
    /\bgrowing\s+perpetuity\b/i.test(pageText) ||
    /\bnormal\s+curve\b/i.test(pageText)
  );
}

/** Artifact markers some publishers stamp into task pages; not part of the brief. */
function cleanLineText(text: string): string {
  return text
    .replace(/^\s*TRIGGER\b/gi, "")
    .replace(/\s+\bTRIGGER\b/gi, " ")
    .replace(/\b(?:zero\s+sum\s+game|60%\s*x\s*25\s*=\s*15\s*marks|\(\s*Time\s+\d+\s+minutes\s*\))\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best-effort multiple-choice extraction for objective-test papers. The Kaplan /
 * Astranti case-study samples use a different layout entirely; this parser is only
 * exercised when an objective-test document is uploaded, and its output is always
 * flagged for review in `notes`.
 */
function parseObjectiveQuestions(pages: PageText[]): PdfObjectiveQuestion[] {
  const full = pages.map((page) => page.text).join(" \n ");
  const questions: PdfObjectiveQuestion[] = [];
  const optionPattern = /\b([A-Ea-e])\s*[.)]\s*([^;|]{2,200}?)(?=\s{1,3}[A-Ea-e]\s*[.)]|$)/gi;
  const answerPattern = /\b(?:answer|correct answer|correct option|ans\.?)\s*[:=]\s*\(?\s*([A-Ea-e0-9])/gi;

  // Number + prompt then lettered options on the same line (typical objective test).
  const loosePattern = /(?:^|\s)(\d{1,3})\s*[.)]\s+(.{20,400}?)(?=\s{1,3}(?:[A-E])\s*[.)])/g;
  let match: RegExpExecArray | null;
  while ((match = loosePattern.exec(full)) !== null) {
    const prompt = collapseWhitespace(match[2]);
    if (!prompt) continue;
    const scope = full.slice(match.index + match[0].length, full.length).slice(0, 600);
    const options: string[] = [];
    let optionText: RegExpExecArray | null;
    optionPattern.lastIndex = 0;
    while ((optionText = optionPattern.exec(scope)) !== null) {
      options.push(collapseWhitespace(optionText[2]).replace(/^(?:This|This option|Item)\s+is\s+not\s+correct\.?|^\s*$/i, "").trim());
      if (options.length >= 8) break;
    }
    if (options.length < 2) continue;
    answerPattern.lastIndex = 0;
    const answer = answerPattern.exec(scope);
    const correctLetter = answer ? answer[1].toLowerCase() : "";
    const correctIndex = correctLetter ? options.findIndex((_, index) => String.fromCharCode(97 + index) === correctLetter) : -1;
    questions.push({
      topic: `Question ${match[1]}`,
      prompt,
      options: options.filter(Boolean),
      correct: correctIndex >= 0 ? correctIndex : 0,
      questionType: "single_choice",
    });
  }
  return questions;
}

/** One task's slice of the paper while pages are being classified. */
type TaskSegment = {
  number: number;
  title: string;
  minutes: number;
  lines: TextLine[];
  refPages: Set<number>;
  refStarted: boolean;
};

export async function parseExamPdf(input: { fileName: string; base64: string }): Promise<PdfExamDraft> {
  const notes: string[] = [];
  const payload = Buffer.from(stripDataUrl(input.base64), "base64");
  if (!payload.length) {
    return {
      fileName: input.fileName,
      isSolutionsDocument: false,
      examType: "case_study",
      priceCents: 0,
      accessDays: 30,
      totalDurationSeconds: 2700,
      notes: ["The uploaded file could not be read as a PDF. Check the file and try again."],
    };
  }
  // pdfjs transfers/consumes the buffer it is given, so hand each consumer its own copy.
  const pdfData = new Uint8Array(payload);
  const coverCopy = new Uint8Array(payload);
  const carveSource = new Uint8Array(payload);
  const pages = await extractPageTexts(pdfData);
  if (!pages.length) {
    return {
      fileName: input.fileName,
      isSolutionsDocument: false,
      examType: "case_study",
      priceCents: 0,
      accessDays: 30,
      totalDurationSeconds: 2700,
      notes: ["The uploaded file could not be read as a PDF. Check the file and try again."],
    };
  }

  const isSolutionsDocument = detectSolutionsDocument(input.fileName, pages);
  const coverText = await extractCoverText(coverCopy);
  const allText = pages.map((page) => page.text).join(" ");

  const title = isSolutionsDocument ? null : extractCoverTitle(coverText, input.fileName);
  const examType: "case_study" | "objective_test" = detectObjectiveTest(coverText, allText) ? "objective_test" : "case_study";
  if (examType === "objective_test") notes.push("Detected an objective-test paper. Questions and answers are extracted heuristically — review each one before saving.");

  if (isSolutionsDocument) {
    notes.push("This file looks like a suggested-solutions / answers / marking-guide document — nothing in it was treated as exam content.");
    notes.push("It will be attached as the exam's feedback document. Attach the question-paper PDF below to build the exam itself.");
    return {
      fileName: input.fileName,
      isSolutionsDocument: true,
      examType,
      priceCents: 0,
      accessDays: 30,
      totalDurationSeconds: 2700,
      feedbackFile: { fileName: input.fileName, mimeType: "application/pdf", base64: input.base64 },
      notes: notes.filter((entry, index) => notes.indexOf(entry) === index),
    };
  }

  if (examType === "objective_test") {
    const objectiveQuestions = parseObjectiveQuestions(pages);
    if (!objectiveQuestions.length) {
      notes.push("Could not reliably break the paper into question blocks — add (or correct) the questions in the studio before saving.");
    }
    return {
      fileName: input.fileName,
      isSolutionsDocument: false,
      examType,
      title: title ?? undefined,
      priceCents: 0,
      accessDays: 30,
      totalDurationSeconds: 2700,
      preModeratedPdf: { fileName: input.fileName, mimeType: "application/pdf", base64: input.base64 },
      objectiveQuestions,
      notes,
    };
  }

  // ---- case-study parsing ------------------------------------------------
  // Pages are streamed in order and filed per task: each task keeps its brief lines
  // (scenario + the email it was issued as) and the page numbers of its reference
  // material. Pages that belong to no task are classified as pre-seen, formulae,
  // shared reference or skipped, exactly as before.
  const segments: TaskSegment[] = [];
  const preSeenPages: number[] = [];
  const formulaePages: number[] = [];
  const unattributedReferencePages: number[] = [];
  const unclassifiedPages: number[] = [];
  let current: TaskSegment | null = null;

  const appendLines = (segment: TaskSegment, page: PageText, lines: TextLine[]) => {
    for (const line of lines) {
      const text = cleanLineText(line.text);
      if (!text) continue;
      if (/\breference\s+material\b/i.test(text)) {
        // Everything from the "Reference material" heading on is that task's
        // reference block — kept as carved pages, not as brief text.
        segment.refStarted = true;
        segment.refPages.add(line.page);
        continue;
      }
      if (segment.refStarted) {
        segment.refPages.add(line.page);
        continue;
      }
      segment.lines.push({ ...line, text });
    }
    if (segment.refStarted) segment.refPages.add(page.pageNumber);
  };

  const classifyLoosePage = (page: PageText) => {
    if (looksLikePreSeen(page.text)) {
      preSeenPages.push(page.pageNumber);
      return;
    }
    const hasEmailHeader = page.lines.some((line) => isEmailHeaderLine(line.text));
    if (looksLikeFormulae(page.text) && !looksLikeReference(page.text) && !hasEmailHeader) {
      formulaePages.push(page.pageNumber);
      return;
    }
    if (looksLikeReference(page.text) || hasEmailHeader) {
      if (current) {
        current.refPages.add(page.pageNumber);
        current.refStarted = true;
      } else {
        unattributedReferencePages.push(page.pageNumber);
      }
      return;
    }
    // Once a task's reference block has started, further unlabelled pages are
    // continuation pages of that block (a table spilling over, say).
    if (current?.refStarted) {
      current.refPages.add(page.pageNumber);
      return;
    }
    unclassifiedPages.push(page.pageNumber);
  };

  for (const page of pages) {
    if (page.pageNumber === 1) continue;
    if (!page.lines.length) continue;
    if (/\bDuring\s+the\s+exam\b/i.test(page.text) || (/\bInstructions?\b/i.test(page.text) && page.text.length < 900)) continue;
    if (/\b(?:expressly\s+disclaim\s+all\s+liability|no\s+part\s+of\s+this\s+examination\s+may\s+be\s+reproduced|all\s+rights\s+reserved)\b/i.test(page.text)) continue;

    const headingIndexes: number[] = [];
    page.lines.forEach((line, index) => {
      if (matchTaskHeading(line.text)) headingIndexes.push(index);
    });

    if (!headingIndexes.length) {
      classifyLoosePage(page);
      continue;
    }

    // Lines before the first heading belong to the previous task (a reference tail
    // sharing the page with the next task's heading).
    if (headingIndexes[0]! > 0 && current) appendLines(current, page, page.lines.slice(0, headingIndexes[0]!));

    headingIndexes.forEach((lineIndex, order) => {
      const line = page.lines[lineIndex]!;
      const heading = matchTaskHeading(line.text)!;
      current = {
        number: heading.number,
        title: heading.title ? `Task ${heading.number} — ${heading.title}` : `Task ${heading.number}`,
        minutes: Math.max(1, heading.minutes),
        lines: [],
        refPages: new Set<number>(),
        refStarted: false,
      };
      segments.push(current);
      const rest = cleanLineText(line.text.slice(heading.headingEnd));
      const chunk: TextLine[] = [];
      if (rest) chunk.push({ ...line, text: rest });
      chunk.push(...page.lines.slice(lineIndex + 1, headingIndexes[order + 1] ?? page.lines.length));
      appendLines(current, page, chunk);
    });
  }

  // ---- build the draft --------------------------------------------------
  const sections: PdfTaskSection[] = [];
  let firstEmail: { from?: string; to?: string; subject?: string; text?: string } | null = null;

  for (const segment of segments) {
    const emailStart = findEmailStart(segment.lines);
    const introLines = emailStart >= 0 ? segment.lines.slice(0, emailStart) : segment.lines;
    const introduction = introLines.length ? linesToHtml(introLines) : undefined;

    let emailFrom: string | undefined;
    let emailTo: string | undefined;
    let emailSubject: string | undefined;
    let emailText: string | undefined;
    if (emailStart >= 0) {
      const parsed = parseEmailAt(segment.lines, emailStart);
      const bodyLines = sliceEmailBody(segment.lines, parsed.bodyStart);
      emailFrom = parsed.from;
      emailTo = parsed.to;
      emailSubject = parsed.subject;
      emailText = bodyLines.length ? linesToHtml(bodyLines) : undefined;
      if (!firstEmail && (emailFrom || emailSubject)) {
        firstEmail = { from: emailFrom, to: emailTo, subject: emailSubject, text: emailText };
      }
    }

    sections.push({
      sectionNumber: segment.number,
      title: segment.title,
      introduction: introduction || undefined,
      durationSeconds: Math.max(60, segment.minutes * 60),
      emailFrom,
      emailTo,
      emailSubject,
      emailText,
    });
  }

  sections.sort((a, b) => a.sectionNumber - b.sectionNumber);

  const unclassifiedText = formatPageRanges(unclassifiedPages);
  if (unclassifiedText) {
    notes.push(`Pages ${unclassifiedText} were not recognised as tasks, pre-seen, reference material or formulae, and were skipped. Check the source paper if this looks wrong.`);
  }
  if (preSeenPages.length) {
    notes.push("A pre-seen / advance-information section was detected and carved into the Pre-seen attachment. Check the page range before saving.");
  }
  if (!sections.length) {
    notes.push("No case-study tasks were found — add the sections (tasks) below or use a different source PDF.");
  }

  const totalSeconds = sections.reduce((sum, section) => sum + section.durationSeconds, 0);
  const coverSeconds = coverText.match(/(\d+)\s*hours?/i) ? Number(coverText.match(/(\d+)\s*hours?/i)![1]) * 3600 : 0;
  const totalDurationSeconds = totalSeconds > 0 ? totalSeconds : coverSeconds > 0 ? coverSeconds : 2700;

  if (!title) notes.push("Could not determine an exam title from the cover page — set it below.");
  if (!firstEmail) notes.push("No email brief was found in the paper — compose the email attachment manually.");
  const anyTaskRef = segments.some((segment) => segment.refPages.size > 0);
  if (!preSeenPages.length && !unattributedReferencePages.length && !formulaePages.length && !anyTaskRef) {
    notes.push("No pre-seen, reference material or formulae pages were detected — attach them manually if the paper includes any.");
  }

  const baseName = (input.fileName.replace(/\.[a-z0-9]+$/i, "") || "exam")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  // Per-task reference material: each task's own pages, so the studio can attach
  // them to that task's Reference material slot. The combined carve below keeps the
  // exam-level reference resource available too.
  const perTaskRefs = await Promise.all(
    segments.map(async (segment) => {
      const refPages = Array.from(segment.refPages).sort((a, b) => a - b);
      const carved = await carvePdf(carveSource, refPages, baseName, `-task-${segment.number}-reference`);
      return { number: segment.number, carved };
    }),
  );
  const refByNumber = new Map(perTaskRefs.map((entry) => [entry.number, entry.carved]));
  for (const section of sections) {
    section.reference = refByNumber.get(section.sectionNumber) ?? null;
  }

  const combinedReferencePages = Array.from(new Set(unattributedReferencePages.concat(...segments.map((segment) => Array.from(segment.refPages))))).sort((a, b) => a - b);

  const [preSeen, reference, formulae] = await Promise.all([
    carvePdf(carveSource, preSeenPages, baseName, "-pre-seen"),
    carvePdf(carveSource, combinedReferencePages, baseName, "-reference"),
    carvePdf(carveSource, formulaePages, baseName, "-formulae-tables"),
  ]);

  return {
    fileName: input.fileName,
    isSolutionsDocument: false,
    examType,
    title: title ?? undefined,
    priceCents: 0,
    accessDays: 30,
    totalDurationSeconds,
    emailFrom: firstEmail?.from,
    emailTo: firstEmail?.to,
    emailSubject: firstEmail?.subject,
    emailText: firstEmail?.text,
    preModeratedPdf: { fileName: input.fileName, mimeType: "application/pdf", base64: input.base64 },
    preSeen,
    formulae,
    reference,
    caseStudySections: sections.length ? sections : undefined,
    notes,
  };
}
