/**
 * Turns uploaded reference material (PDF, Word, text, Markdown, HTML, images) into HTML the
 * printable exam can set as text.
 *
 * Reference, pre-seen, formulae and instruction documents used to be pasted onto the printable
 * as page images. That made the paper harder to read, harder to copy, and it pushed the
 * printable's own design out of line with the rest of the document. Interpreting the file here
 * means a table in a reference sheet prints as a table, a formula list prints as text, and the
 * candidate sees the same typography as the rest of the paper. Only content that cannot be read
 * as text (a scanned PDF, an image) is left to be embedded as a picture.
 */
import "./_core/polyfills";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { sanitizeAuthoredHtml, escapeHtml } from "@shared/richText";

export type InterpretedDocument =
  | { kind: "html"; html: string }
  | { kind: "image"; mimeType: "image/png" | "image/jpeg"; bytes: Buffer }
  | { kind: "unsupported" };

export type TextItem = { str: string; x: number; y: number; width: number };
export type TextLine = { y: number; cells: { x: number; text: string }[] };

/* ------------------------------------------------------------------ *
 * Layout reconstruction (pure)
 * ------------------------------------------------------------------ */

const SAME_LINE_TOLERANCE = 2.5;
/** Gap between two text items, in points, above which they are treated as separate cells. */
const CELL_GAP = 9;
const COLUMN_TOLERANCE = 14;

/** Groups positioned text items into visual lines, each split into cells by horizontal gaps. */
export function linesFromItems(items: TextItem[]): TextLine[] {
  const usable = items.filter((item) => item.str.trim().length > 0);
  const sorted = [...usable].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const item of sorted) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= SAME_LINE_TOLERANCE);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows.map((row) => {
    const ordered = row.items.sort((a, b) => a.x - b.x);
    const cells: { x: number; text: string }[] = [];
    let previousEnd = Number.NEGATIVE_INFINITY;
    for (const item of ordered) {
      const text = item.str.replace(/\s+/g, " ");
      const last = cells[cells.length - 1];
      if (last && item.x - previousEnd < CELL_GAP) {
        last.text = `${last.text}${/\s$/.test(last.text) || /^\s/.test(text) ? "" : " "}${text.trimStart()}`;
      } else {
        cells.push({ x: item.x, text: text.trimStart() });
      }
      previousEnd = item.x + item.width;
    }
    return { y: row.y, cells: cells.map((cell) => ({ x: cell.x, text: cell.text.trimEnd() })) };
  });
}

/** Clusters x positions into column anchors, so ragged cell starts line up to one column. */
function columnAnchors(xs: number[]): number[] {
  const sorted = [...xs].sort((a, b) => a - b);
  const anchors: number[][] = [];
  for (const x of sorted) {
    const group = anchors[anchors.length - 1];
    if (group && x - group[group.length - 1]! <= COLUMN_TOLERANCE) group.push(x);
    else anchors.push([x]);
  }
  return anchors.map((group) => group.reduce((sum, x) => sum + x, 0) / group.length);
}

function nearestColumn(x: number, anchors: number[]): number {
  let best = 0;
  for (let index = 1; index < anchors.length; index += 1) {
    if (Math.abs(anchors[index]! - x) < Math.abs(anchors[best]! - x)) best = index;
  }
  return best;
}

function paragraphHtml(text: string): string {
  return `<p>${escapeHtml(text)}</p>`;
}

/**
 * Renders reconstructed lines as HTML. A run of at least two consecutive multi-cell lines whose
 * cells line up on two or more columns becomes a table; everything else becomes paragraphs. That
 * keeps a two-column reference grid a grid, while a prose line that happens to contain a wide
 * space is still read as prose.
 */
export function linesToHtml(lines: TextLine[]): string {
  const out: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const multi = lines[index]!.cells.length >= 2;
    let end = index;
    if (multi) while (end < lines.length && lines[end]!.cells.length >= 2) end += 1;
    const run = lines.slice(index, end);
    const anchors = multi && run.length >= 2 ? columnAnchors(run.flatMap((line) => line.cells.map((cell) => cell.x))) : [];
    if (multi && run.length >= 2 && anchors.length >= 2 && anchors.length <= 12) {
      const rows = run.map((line) => {
        const cells = anchors.map(() => "");
        for (const cell of line.cells) {
          const column = nearestColumn(cell.x, anchors);
          cells[column] = cells[column] ? `${cells[column]} ${cell.text}` : cell.text;
        }
        return cells;
      });
      out.push(
        `<table><tbody>${rows
          .map((cells, rowIndex) => `<tr>${cells.map((cell) => (rowIndex === 0 ? `<th>${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`)).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      index = end;
      continue;
    }
    out.push(paragraphHtml(lines[index]!.cells.map((cell) => cell.text).join(" ")));
    index += 1;
  }
  return out.join("");
}

/** Converts plain text or Markdown (including pipe tables) to HTML. */
export function textToHtml(text: string): string {
  const out: string[] = [];
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const block of blocks) {
    const rows = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!rows.length) continue;
    if (rows.length >= 2 && rows.every((row) => row.startsWith("|") && row.endsWith("|"))) {
      const cells = rows
        .filter((row) => !/^\|?\s*:?-{3,}/.test(row))
        .map((row) => row.slice(1, -1).split("|").map((cell) => cell.trim()));
      if (cells.length) {
        out.push(
          `<table><tbody>${cells
            .map((row, index) => `<tr>${row.map((cell) => (index === 0 ? `<th>${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`)).join("")}</tr>`)
            .join("")}</tbody></table>`,
        );
        continue;
      }
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(rows[0]!);
    if (rows.length === 1 && heading) {
      out.push(`<h${heading[1]!.length + 1}>${escapeHtml(heading[2]!)}</h${heading[1]!.length + 1}>`);
      continue;
    }
    for (const row of rows) {
      const bullet = /^[-*•]\s+(.*)$/.exec(row);
      out.push(bullet ? `<p>• ${escapeHtml(bullet[1]!)}</p>` : paragraphHtml(row));
    }
  }
  return out.join("");
}

/* ------------------------------------------------------------------ *
 * Format detection
 * ------------------------------------------------------------------ */

export function sniffKind(bytes: Buffer, fileName: string, mimeType?: string): "pdf" | "docx" | "png" | "jpeg" | "text" | "html" | "unknown" {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (bytes[0] === 0x89 && bytes.subarray(1, 4).toString("latin1") === "PNG") return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "docx";
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (mimeType === "text/html" || extension === "html" || extension === "htm") return "html";
  if (extension === "txt" || extension === "md" || extension === "markdown" || extension === "csv" || mimeType?.startsWith("text/")) return "text";
  return "unknown";
}

/* ------------------------------------------------------------------ *
 * Extraction
 * ------------------------------------------------------------------ */

async function pdfToHtml(bytes: Buffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const parts: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const transform = item.transform as number[];
      items.push({ str: item.str, x: transform[4] ?? 0, y: transform[5] ?? 0, width: item.width ?? 0 });
    }
    parts.push(linesToHtml(linesFromItems(items)));
  }
  return parts.join("");
}

async function docxToHtml(bytes: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml(
    { buffer: bytes },
    {
      convertImage: mammoth.images.imgElement(async (image: { contentType: string; read: (encoding: string) => Promise<string> }) => {
        const data = await image.read("base64");
        return { src: `data:${image.contentType};base64,${data}` };
      }),
    },
  );
  return result.value;
}

/**
 * Interprets a reference document as printable content. Returns `unsupported` when the file has
 * no readable text (for example a scanned PDF), so the caller can fall back to embedding it.
 */
export async function interpretDocument(input: { bytes: Buffer; fileName: string; mimeType?: string }): Promise<InterpretedDocument> {
  const kind = sniffKind(input.bytes, input.fileName, input.mimeType);
  try {
    if (kind === "png" || kind === "jpeg") return { kind: "image", mimeType: kind === "png" ? "image/png" : "image/jpeg", bytes: input.bytes };
    let html = "";
    if (kind === "pdf") {
      html = await pdfToHtml(input.bytes);
      const words = html.replace(/<[^>]+>/g, " ").trim();
      if (words.length < 20) return { kind: "unsupported" };
    } else if (kind === "docx") {
      html = await docxToHtml(input.bytes);
    } else if (kind === "text") {
      html = textToHtml(input.bytes.toString("utf8"));
    } else if (kind === "html") {
      html = sanitizeAuthoredHtml(input.bytes.toString("utf8"));
    } else {
      return { kind: "unsupported" };
    }
    return html.replace(/<[^>]+>/g, "").trim() ? { kind: "html", html } : { kind: "unsupported" };
  } catch {
    return { kind: "unsupported" };
  }
}
