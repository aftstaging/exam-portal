import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument } from "pdf-lib";

export type PdfFile = { fileName: string; mimeType: string; base64: string };

export type PdfTaskSection = {
  sectionNumber: number;
  title: string;
  introduction?: string;
  scenario?: string;
  question?: string;
  durationSeconds: number;
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

type PageText = { pageNumber: number; text: string };

function stripDataUrl(base64: string): string {
  return base64.includes(",") ? base64.split(",")[1] ?? base64 : base64;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Removes the running headers / footers that Kaplan (and Astranti) stamp on every
 * page. These tokens otherwise leak into the first line of every page and would
 * confuse heading detection. Page footer numbers are left in place — harmless.
 */
function stripRunningHeaders(text: string): string {
  let value = text;
  value = value.replace(/\bMO\s+CK\s+B\b/gi, " ");
  value = value.replace(/\bMOCK\s+EXAM\s+[A-Z0-9]+\b/gi, " ");
  value = value.replace(/\bCIMA\s+MANAGE\s+MENT\s+LEVEL\s+CASE\s+ST\s+UDY\b/gi, " ");
  value = value.replace(/\bCIMA\s+MANAGEMENT\s+LEVEL\s+CASE\s+STUDY\b/gi, " ");
  value = value.replace(/\bKAPLAN PUBLISHING\b/gi, " ");
  value = value.replace(/\bKAPLAN FINANCIAL\b/gi, " ");
  value = value.replace(/\bManagement\s+Case\s+Study\s+Mock\s+Exam\s+\d+\b/gi, " ");
  value = value.replace(/©\s*Astranti\s+\d{4}/gi, " ");
  return collapseWhitespace(value);
}

async function extractPageTexts(pdfData: Uint8Array): Promise<PageText[]> {
  const doc = await getDocument({ data: pdfData, useSystemFonts: true }).promise;
  const pages: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const raw = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push({ pageNumber: i, text: stripRunningHeaders(raw) });
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

function encodeEmailBody(text: string): string {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => sentence.replace(/^Hi,\s*/i, ""))
    .join("<br />");
}

function detectSolutionsDocument(fileName: string, pages: PageText[]): boolean {
  const base = fileName.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  if (/\b(solutions?|answers?|marking[-_ ]?guide|suggested[-_ ]?answers?|debrief)\b/.test(base)) return true;
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

/**
 * Best-effort multiple-choice extraction for objective-test papers. The Kaplan /
 * Astranti case-study samples use a different layout entirely; this parser is only
 * exercised when an objective-test document is uploaded, and its output is always
 * flagged for review in `notes`.
 */
function parseObjectiveQuestions(pages: PageText[]): PdfObjectiveQuestion[] {
  const full = pages.map((page) => page.text).join(" \n ");
  const questions: PdfObjectiveQuestion[] = [];
  const optionPattern = /\b([A-Ea-e])\s*[.)]\s*([^;|]{2,200}?)(?=\s{1,3}[A-Ea-e]\s*[.)]\s*|$)/gi;
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
    const fileName = input.fileName.replace(/\.[a-z0-9]+$/i, "") || "suggested-solutions";
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
  const sections: PdfTaskSection[] = [];
  const referencePages: number[] = [];
  const formulaePages: number[] = [];
  const unclassifiedPages: number[] = [];
  let firstEmailHeader: { from?: string; to?: string; subject?: string } | null = null;
  let firstEmailBody = "";

  for (const page of pages) {
    if (page.pageNumber === 1) continue;
    if (/\bDuring\s+the\s+exam\b/i.test(page.text) || (/\bInstructions?\b/i.test(page.text) && page.text.length < 900)) continue;
    if (/\b(?:expressly\s+disclaim\s+all\s+liability|no\s+part\s+of\s+this\s+examination\s+may\s+be\s+reproduced|all\s+rights\s+reserved)\b/i.test(page.text)) continue;
    const heading = matchTaskHeading(page.text);
    if (heading) {
      const remainder = page.text.slice(heading.headingEnd).trim();
      const header = extractEmailHeader(remainder);
      if (header.from || header.to || header.subject) {
        if (!firstEmailHeader) {
          firstEmailHeader = { from: header.from, to: header.to, subject: header.subject };
        }
        const bodyStart = remainder.indexOf("Subject:");
        const bodyFrom = bodyStart >= 0 ? remainder.slice(bodyStart + "Subject:".length) : remainder;
        if (!firstEmailBody && bodyFrom.trim()) {
          const endMarker = bodyFrom.search(/\b(Kind\s+regards|Best\s+regards|Regards,|Warm\s+regards)\b/i);
          const rawBody = endMarker >= 0 ? bodyFrom.slice(0, endMarker) : bodyFrom;
          firstEmailBody = encodeEmailBody(collapseWhitespace(rawBody));
        }
      }
      const taskIntro = remainder
        .replace(/^\s*TRIGGER\b/gi, "")
        .replace(/\s+\bTRIGGER\b/gi, " ")
        .replace(/\b(?:zero\s+sum\s+game|60%\s*x\s*25\s*=\s*15\s*marks|\(\s*Time\s+\d+\s+minutes\s*\))\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      sections.push({
        sectionNumber: heading.number,
        title: heading.title ? `Task ${heading.number} — ${heading.title}` : `Task ${heading.number}`,
        introduction: taskIntro || undefined,
        durationSeconds: Math.max(60, heading.minutes * 60),
      });
      continue;
    }
    if (looksLikeFormulae(page.text)) {
      formulaePages.push(page.pageNumber);
      continue;
    }
    if (looksLikeReference(page.text) || extractEmailHeader(page.text).from) {
      referencePages.push(page.pageNumber);
      continue;
    }
    unclassifiedPages.push(page.pageNumber);
  }

  sections.sort((a, b) => a.sectionNumber - b.sectionNumber);
  if (unclassifiedPages.length) {
    notes.push(`Pages ${unclassifiedPages.join(", ")} were not recognised as tasks, reference material or formulae, and were skipped. Check the source paper if this looks wrong.`);
  }
  if (!sections.length) {
    notes.push("No case-study tasks were found — add the sections (tasks) below or use a different source PDF.");
  }

  const totalSeconds = sections.reduce((sum, section) => sum + section.durationSeconds, 0);
  const coverSeconds = coverText.match(/(\d+)\s*hours?/i) ? Number(coverText.match(/(\d+)\s*hours?/i)![1]) * 3600 : 0;
  const totalDurationSeconds = totalSeconds > 0 ? totalSeconds : coverSeconds > 0 ? coverSeconds : 2700;

  if (!title) notes.push("Could not determine an exam title from the cover page — set it below.");
  if (!firstEmailHeader && !firstEmailBody) notes.push("No email brief was found in the paper — compose the email attachment manually.");
  if (!referencePages.length && !formulaePages.length) notes.push("No reference material or formulae pages were detected — attach them manually if the paper includes any.");

  const baseName = (input.fileName.replace(/\.[a-z0-9]+$/i, "") || "exam")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  const [reference, formulae] = await Promise.all([
    carvePdf(carveSource, referencePages, baseName, "-reference"),
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
    emailFrom: firstEmailHeader?.from,
    emailTo: firstEmailHeader?.to,
    emailSubject: firstEmailHeader?.subject,
    emailText: firstEmailBody || undefined,
    preModeratedPdf: { fileName: input.fileName, mimeType: "application/pdf", base64: input.base64 },
    preSeen: null,
    formulae,
    reference,
    caseStudySections: sections.length ? sections : undefined,
    notes,
  };
}