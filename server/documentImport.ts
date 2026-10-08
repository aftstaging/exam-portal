/**
 * Builds an exam draft from any supported document: PDF, Word, plain text, Markdown, HTML or a
 * picture. A PDF keeps the existing parser, which reads the AFT layout. Every other format is
 * converted to HTML and split into tasks on headings such as "Task 1" or "Section 2", so the
 * draft lands in the same fields a hand-built exam uses and the author can review it before saving.
 */
import { interpretDocument, sniffKind } from "./documentText";
import { parseExamPdf, type PdfExamDraft } from "./pdfImport";
import { sanitizeAuthoredHtml } from "@shared/richText";

export const IMPORTABLE_EXTENSIONS = ["pdf", "docx", "txt", "md", "markdown", "html", "htm", "png", "jpg", "jpeg"] as const;

const DEFAULT_DURATION_SECONDS = 3 * 60 * 60;
const TASK_HEADING = /^\W*(task|section|part|question)\s*\d+/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || "Imported exam";
}

/** Splits converted HTML into one chunk per top-level block, so headings can start a new task. */
function blockChunks(html: string): string[] {
  return html.split(/(?=<(?:h[1-6]|p|ul|ol|table|div)[\s>])/i).filter((chunk) => chunk.trim());
}

/** Builds the draft from converted HTML: text before the first task heading is the brief. */
export function draftFromHtml(fileName: string, html: string): PdfExamDraft {
  const chunks = blockChunks(sanitizeAuthoredHtml(html));
  const starts = chunks.map((chunk, index) => (TASK_HEADING.test(stripTags(chunk)) ? index : -1)).filter((index) => index >= 0);
  const introChunks = starts.length ? chunks.slice(0, starts[0]) : chunks;
  const taskRanges = starts.map((start, index) => chunks.slice(start, starts[index + 1] ?? chunks.length));
  const totalDurationSeconds = DEFAULT_DURATION_SECONDS;
  const sectionDuration = Math.max(60, Math.round(totalDurationSeconds / Math.max(1, taskRanges.length || 1)));
  const caseStudySections = taskRanges.length
    ? taskRanges.map((range, index) => {
        const heading = stripTags(range[0] ?? "");
        return {
          sectionNumber: index + 1,
          title: heading.replace(TASK_HEADING, "").replace(/^[\s:.\-–—]+/, "").slice(0, 160) || `Task ${index + 1}`,
          durationSeconds: sectionDuration,
          introduction: range.slice(1).join("") || undefined,
        };
      })
    : [];
  const notes = [
    `Imported from ${fileName}. Review the brief, tasks and attachments before saving.`,
    caseStudySections.length ? `Found ${caseStudySections.length} task${caseStudySections.length === 1 ? "" : "s"}.` : "No task headings were found, so the whole document is the brief. Add the tasks in the editor.",
  ];
  return {
    fileName,
    isSolutionsDocument: false,
    title: titleFromFileName(fileName),
    examType: "case_study",
    intro: introChunks.join("") || undefined,
    priceCents: 0,
    accessDays: 30,
    totalDurationSeconds,
    caseStudySections,
    notes,
  };
}

/**
 * Reads an uploaded exam document of any supported type into a draft. Throws for an unreadable
 * file, so the caller can report it.
 */
export async function parseExamDocument(input: { fileName: string; mimeType?: string; base64: string }): Promise<PdfExamDraft> {
  const bytes = Buffer.from(input.base64.replace(/^data:[^,]*,/, ""), "base64");
  if (!bytes.length) throw new Error("The file is empty.");
  const kind = sniffKind(bytes, input.fileName, input.mimeType);
  if (kind === "pdf") return parseExamPdf({ fileName: input.fileName, base64: input.base64 });
  const interpreted = await interpretDocument({ bytes, fileName: input.fileName, mimeType: input.mimeType });
  if (interpreted.kind === "html") return draftFromHtml(input.fileName, interpreted.html);
  if (interpreted.kind === "image") {
    // A picture of the paper has no text to split, so it becomes one task holding the picture.
    const dataUrl = `data:${interpreted.mimeType};base64,${bytes.toString("base64")}`;
    return draftFromHtml(input.fileName, `<p><img src="${dataUrl}" alt="${input.fileName.replace(/"/g, "")}"></p>`);
  }
  throw new Error("This file type has no readable content. Use a PDF, Word, text, Markdown, HTML or image file.");
}
