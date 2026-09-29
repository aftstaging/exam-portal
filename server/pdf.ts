import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { AFT_LOGO_BASE64 } from "./aftLogo";

export type PrintableExam = {
  title: string;
  intro: string | null;
  totalDurationSeconds: number;
  examType?: "case_study" | "objective_test" | null;
};
export type PrintableSection = {
  sectionNumber: number;
  title: string;
  durationSeconds: number;
  introduction: string | null;
  scenario?: string | null;
  question?: string | null;
  email?: PrintableEmail | null;
  attachmentTitles?: string[];
  attachments?: PrintableAttachment[];
  /**
   * Printed immediately after the task's instructions, before the email and the reference
   * material. A task's instruction sheet belongs with the instructions it belongs to, and a
   * candidate reading the paper top to bottom has to meet it there rather than at the foot of
   * the section.
   */
  introAttachmentTitles?: string[];
  introAttachments?: PrintableAttachment[];
};
export type PrintableEmail = { from?: string | null; to?: string | null; subject?: string | null; html?: string | null };
export type PrintableAttachment = { kind: string; title: string; base64?: string | null; mimeType?: string | null };

/** A contiguous stretch of text that shares one emphasis state. */
type RichRun = { text: string; bold: boolean };

/** One renderable block: `marker` is the list marker drawn in the hanging indent, `depth` the nesting level. */
type RichBlock = { marker: string | null; depth: number; runs: RichRun[]; table?: RichTable };

/** A borderless HTML table: rows of cells, each cell holding its own nested blocks. */
type RichTable = { rows: RichBlock[][][]; headerRow: boolean };

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
 * that share an emphasis state.
 *
 * Runs are stored without leading or trailing whitespace, so a single space is re-inserted
 * between runs at draw time. Words split across an emphasis boundary (`total<b>cost</b>ing`)
 * therefore stay joined in the output even though they are separate runs.
 */
function partsToRuns(parts: { text: string; bold: boolean }[]): RichRun[] {
  const runs: RichRun[] = [];
  // Tracks whether a whitespace run preceded the current token: a continuation inside a
  // single word is rejoined without a space, while a genuinely new word gets one.
  let space = false;
  let emitted = false;

  for (const part of parts) {
    for (const piece of part.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        space = emitted;
        continue;
      }
      const previous = runs[runs.length - 1];
      if (previous && previous.bold === part.bold) previous.text += `${space ? " " : ""}${piece}`;
      else runs.push({ text: piece, bold: part.bold });
      emitted = true;
      space = false;
    }
  }
  return runs;
}

const TAG_PATTERN = /<(\/)?([a-z][a-z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*)>/gi;

/**
 * Scans author-supplied HTML into a flat block stream, preserving bullet/numbered lists
 * (with nesting depth) and inline emphasis.
 *
 * Tables are not handled here: `parseRichHtml` lifts them out before scanning and splices
 * them back afterwards, which keeps this scanner a simple linear pass.
 *
 * Only the regular and bold faces are embedded, so italic and underline runs render in the
 * regular face.
 */
function scanBlocks(source: string): RichBlock[] {
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
    // The marker belongs to the block it opens; consuming it here stops a soft break such as
    // `<li>text<br>more</li>` from repeating the bullet on the continuation line.
    pendingMarker = null;
    if (runs.length) blocks.push({ marker, depth, runs });
  };

  let cursor = 0;
  let match: RegExpExecArray | null;
  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(source))) {
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

/** Splits a table's inner HTML into rows of cells, recording whether the first row is a `<th>` row. */
function splitTableRows(inner: string): { rows: string[][]; headerRow: boolean } {
  const rows: string[][] = [];
  let headerRow = false;
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
  const cellPattern = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let row: RegExpExecArray | null;
  let rowIndex = 0;
  while ((row = rowPattern.exec(inner))) {
    const cells: string[] = [];
    let sawHeader = false;
    cellPattern.lastIndex = 0;
    let cell: RegExpExecArray | null;
    while ((cell = cellPattern.exec(row[1]!))) {
      if (cell[1]!.toLowerCase() === "th") sawHeader = true;
      cells.push(cell[2]!);
    }
    if (rowIndex === 0 && sawHeader) headerRow = true;
    // A row whose cells the pattern missed (malformed markup) still needs to occupy a line.
    if (!cells.length) cells.push(row[1]!);
    rows.push(cells);
    rowIndex += 1;
  }
  return { rows, headerRow };
}

/**
 * Parses author-supplied HTML into renderable blocks, preserving list structure, inline
 * emphasis and tables. Tables are lifted out of the markup first and spliced back at their
 * authored position, so prose and tables interleave in source order.
 */
export function parseRichHtml(html: string | null | undefined): RichBlock[] {
  if (!html) return [];
  const source = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const tables: RichTable[] = [];
  const withPlaceholders = source.replace(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi, (_match, inner: string) => {
    const { rows, headerRow } = splitTableRows(inner);
    tables.push({
      rows: rows.map((cells) => cells.map((cell) => scanBlocks(cell.replace(/<br\s*\/?>/gi, "\n")))),
      headerRow,
    });
    // A table is a block, so the placeholder is fenced with explicit block breaks. Without them the
    // scanner keeps accumulating runs until the next closing tag, which merges the prose in front
    // of the table into the placeholder's own block: the text that follows the table still prints,
    // but the table itself is printed as the literal placeholder text instead of being laid out.
    // The breaks are emitted as tags rather than newlines because the scanner breaks blocks on a
    // closing tag, not on a line ending, and a redundant `</p>` flushes nothing.
    return `</p><p>AFT_TABLE_${tables.length - 1}</p><p>`;
  });

  return scanBlocks(withPlaceholders).map((block) => {
    const placeholder = /^AFT_TABLE_(\d+)$/.exec(block.runs[0]?.text ?? "");
    if (!placeholder) return block;
    const table = tables[Number(placeholder[1])];
    return table ? { marker: null, depth: 0, runs: [], table } : block;
  });
}

/* ------------------------------------------------------------------ *
 * Page geometry
 *
 * The sheet is a monochrome A4 page with no drawn rules or table borders, matching
 * the reference document. Width is an integer so page size comparisons are exact.
 * ------------------------------------------------------------------ */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 56.7;
const CONTENT_TOP = PAGE_HEIGHT - 62;
const CONTENT_BOTTOM = 62;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const BODY_SIZE = 10.5;
const BODY_LEADING = 15.5;
const TITLE_SIZE = 23;
const TITLE_LEADING = 29;
const H1_SIZE = 15;
const H1_LEADING = 21;
const H2_SIZE = 11.5;
const H2_LEADING = 16;
const SMALL_SIZE = 8;
const MARKER_GAP = 14;
const NEST_INDENT = 16;
const CELL_PADDING = 5;
const LOGO_HEIGHT = 42;
const MAX_IMAGE_HEIGHT = 320;
/** Below this much space, an attachment image moves to its own page rather than being squeezed. */
const MIN_INLINE_IMAGE_HEIGHT = 150;
/** Layout probe width used to measure a single unwrapped line of table cell text. */
const PROBE_WIDTH = 10_000;

const INK = rgb(0, 0, 0);
const MUTED = rgb(0.38, 0.38, 0.38);

/** WinAnsi code points outside plain ASCII and Latin-1 that the standard fonts do support. */
const WINANSI_CODEPOINTS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);

/** Characters that commonly appear in authored content and have a sensible WinAnsi stand-in. */
const UNICODE_FALLBACKS: Record<string, string> = {
  "\u00a0": " ", "\u00ad": "", "\u200b": "", "\u200c": "", "\u200d": "", "\ufeff": "",
  "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2212": "-", "\u2192": "->", "\u2190": "<-",
  "\u2260": "!=", "\u2264": "<=", "\u2265": ">=", "\u00d7": "x", "\u00f7": "/", "\u00b1": "+/-",
  "\u2044": "/",
};

function isWinAnsi(codePoint: number): boolean {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true;
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true;
  return WINANSI_CODEPOINTS.has(codePoint);
}

/** Printable ASCII, the overwhelmingly common case for authored exam content. */
const PLAIN_ASCII = /^[\x20-\x7e\n\t]*$/;

/**
 * Replaces or removes every character the embedded standard fonts cannot encode.
 *
 * The fonts are WinAnsi-encoded, so an unmappable character would otherwise throw while
 * drawing. Characters with a sensible ASCII equivalent are mapped; the rest are dropped
 * rather than replaced with a placeholder, because a sheet of `?` markers conveys nothing
 * and would multiply the size of imported content that contains stray glyphs.
 */
function sanitizeText(text: string): string {
  // Most content needs no substitution at all, and scanning for that is far cheaper than
  // walking the string code point by code point.
  if (PLAIN_ASCII.test(text)) return text;
  let out = "";
  for (const character of text) {
    const fallback = UNICODE_FALLBACKS[character];
    if (fallback !== undefined) {
      out += fallback;
      continue;
    }
    if (isWinAnsi(character.codePointAt(0) ?? 0)) out += character;
  }
  return out;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);
  if (!hours) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (!minutes) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function examTypeLabel(examType: PrintableExam["examType"]): string {
  if (examType === "case_study") return "Case Study Exam";
  if (examType === "objective_test") return "Objective Test";
  return "Mock Exam";
}

/* ------------------------------------------------------------------ *
 * Line layout
 *
 * Content is measured and broken into `Group`s before anything is drawn. A group is
 * the smallest slice that may not be split across a page break, which keeps list
 * items and table rows intact.
 * ------------------------------------------------------------------ */

type Fonts = { regular: PDFFont; bold: PDFFont };

/** A word-sized chunk of text plus whether a space separates it from the previous chunk. */
type Token = { text: string; bold: boolean; spaceAfter: boolean };

/** One physical line: the runs to paint, the x to start at, and an optional list marker. */
type VisualLine = { runs: RichRun[]; x: number; marker: string | null };

/**
 * Returns a copy of `blocks` with every run set to bold, tables included.
 *
 * Emphasis has to be decided before a line is measured: the bold face is wider than the
 * regular one, so text laid out in one and painted in the other overflows the column it was
 * wrapped against and drifts out of alignment with the rest of the sheet.
 */
function boldedBlocks(blocks: RichBlock[]): RichBlock[] {
  return blocks.map((block) =>
    block.table
      ? { ...block, table: { ...block.table, rows: block.table.rows.map((row) => row.map(boldedBlocks)) } }
      : { ...block, runs: block.runs.map((run) => ({ ...run, bold: true })) },
  );
}

/** A vertical slice of content that stays together, measured in points from its top edge. */
/**
 * A block of pre-measured content ready to paint.
 *
 * `rows` keeps the cells of one table row on a shared baseline; `lines` is the flat form used
 * by paragraphs. `drawGroup` prefers `rows` so every column of a table row is painted.
 */
type Group = { height: number; lines: VisualLine[]; rows?: VisualLine[][]; gapAfter: number; align?: "right" | "center" };

/** Width of a laid-out line, including any list marker drawn in the indent. */
function lineWidth(line: VisualLine, fonts: Fonts, size: number): number {
  let width = 0;
  for (const run of line.runs) {
    const font = run.bold ? fonts.bold : fonts.regular;
    width += font.widthOfTextAtSize(run.text, size);
  }
  if (line.marker) width += MARKER_GAP;
  return width;
}

/**
 * Flattens a table that appears inside a table cell into plain lines.
 *
 * Nested tables are rare in exam content; rendering their cell text in reading order keeps
 * the content visible without needing a second level of column geometry.
 */
function flattenTableBlocks(table: RichTable, fonts: Fonts, size: number, x: number, limitX: number): VisualLine[] {
  const lines: VisualLine[] = [];
  table.rows.forEach((row, rowIndex) => {
    for (const block of row[0] ?? []) {
      if (block.table) {
        lines.push(...flattenTableBlocks(block.table, fonts, size, x, limitX));
        continue;
      }
      lines.push(...layoutRuns(block.runs, fonts, size, x, x, limitX, block.marker));
    }
    if (rowIndex < table.rows.length - 1) lines.push({ runs: [{ text: "", bold: false }], x, marker: null });
  });
  return lines;
}

function splitRuns(runs: RichRun[]): Token[] {
  const tokens: Token[] = [];
  runs.forEach((run, runIndex) => {
    for (const piece of run.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        if (tokens.length) tokens[tokens.length - 1]!.spaceAfter = true;
      } else {
        // Runs carry no surrounding whitespace, so consecutive runs are separated by a space.
        if (runIndex > 0 && tokens.length && !tokens[tokens.length - 1]!.spaceAfter) {
          tokens[tokens.length - 1]!.spaceAfter = true;
        }
        // Sanitising can remove a token entirely; an empty one would occupy a line for nothing.
        const safe = sanitizeText(piece);
        if (safe) tokens.push({ text: safe, bold: run.bold, spaceAfter: false });
      }
    }
  });
  return tokens;
}

function tokenWidth(token: Token, fonts: Fonts, size: number): number {
  return (token.bold ? fonts.bold : fonts.regular).widthOfTextAtSize(token.text, size);
}

/** Minimum characters measured in one pass when estimating how wide a long word is. */
const WIDTH_PROBE_CHARS = 64;

/**
 * Splits a word too wide for any line into chunks that each fit the available width.
 *
 * A pathological input can be a single token tens of thousands of characters long, so the
 * chunk size is estimated from a short sample and then corrected with one measurement per
 * chunk. Measuring every character individually would be linear in count but with a
 * per-glyph call each, which dominates generation time on such input.
 */
function breakLongToken(token: Token, fonts: Fonts, size: number, available: number): Token[] {
  const font = token.bold ? fonts.bold : fonts.regular;
  const text = token.text;
  const pieces: Token[] = [];

  // Seed the chunk size from an averaged sample, then let the fit checks below correct it.
  const sample = text.slice(0, WIDTH_PROBE_CHARS);
  const sampleWidth = font.widthOfTextAtSize(sample, size);
  let chunkSize = sampleWidth > 0 ? Math.max(1, Math.floor((available * sample.length) / sampleWidth)) : text.length;
  chunkSize = Math.min(Math.max(chunkSize, 1), text.length);

  let index = 0;
  let guard = 0;
  while (index < text.length) {
    // Each iteration must consume at least one character; the guard bounds the retries that
    // a pathological mix of wide and zero-width glyphs could otherwise provoke.
    guard += 1;
    if (guard > text.length * 4) {
      pieces.push({ text: text.slice(index), bold: token.bold, spaceAfter: false });
      break;
    }
    let slice = text.slice(index, index + chunkSize);
    let width = font.widthOfTextAtSize(slice, size);
    if (width > available) {
      // Too wide: narrow the probe and retry without consuming anything.
      chunkSize = Math.max(1, Math.floor((chunkSize * available) / width));
      continue;
    }
    // Absorbing the next character would overflow, so emit this chunk as-is.
    if (index + slice.length < text.length) {
      const grown = text.slice(index, index + slice.length + 1);
      if (font.widthOfTextAtSize(grown, size) > available) {
        pieces.push({ text: slice, bold: token.bold, spaceAfter: false });
        index += slice.length;
        continue;
      }
      slice = grown;
    }
    pieces.push({ text: slice, bold: token.bold, spaceAfter: false });
    index += slice.length;
    // Recover the estimated size if this chunk came in well under the limit.
    if (width > 0 && width < available * 0.7) {
      chunkSize = Math.min(text.length, Math.max(1, Math.floor((available * slice.length) / width)));
    }
  }
  return pieces;
}

/** Appends a run to a line, merging it into the previous run when emphasis matches. */
function appendRun(lines: RichRun[], run: RichRun): void {
  const last = lines[lines.length - 1];
  if (last && last.bold === run.bold) last.text += run.text;
  else lines.push({ text: run.text, bold: run.bold });
}

/** Wraps runs into lines, indenting the first line and continuations independently. */
function layoutRuns(
  runs: RichRun[],
  fonts: Fonts,
  size: number,
  firstX: number,
  contX: number,
  limitX: number,
  marker: string | null = null,
): VisualLine[] {
  const tokens: Token[] = [];
  for (const token of splitRuns(runs)) tokens.push(token);
  if (!tokens.length) return [];

  const spaceWidth = fonts.regular.widthOfTextAtSize(" ", size);
  const lines: VisualLine[] = [];
  let current: RichRun[] = [];
  let width = 0;
  let indent = firstX;
  let indentUsed = false;
  let currentMarker = marker;

  const commit = () => {
    if (!current.length) return;
    lines.push({ runs: current, x: indent, marker: indentUsed ? null : currentMarker });
    current = [];
    width = 0;
    indent = contX;
    indentUsed = true;
    currentMarker = null;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    // A word wider than the column is split so it can never overflow the margin.
    if (tokenWidth(token, fonts, size) > limitX - contX) {
      for (const piece of breakLongToken(token, fonts, size, limitX - contX)) {
        if (width > 0) commit();
        current = [];
        appendRun(current, { text: piece.text, bold: piece.bold });
        width = tokenWidth(piece, fonts, size);
        indent = contX;
        indentUsed = true;
        commit();
      }
      continue;
    }
    const lead = current.length && tokens[index - 1]?.spaceAfter ? spaceWidth : 0;
    if (current.length && indent + width + lead + tokenWidth(token, fonts, size) > limitX) {
      // The break itself separates this token from the last one on the previous line, so the
      // gap in front of it is dropped here. Nothing may be cleared from the token's own
      // `spaceAfter`: that gap belongs to the *next* token, and dropping it welds the first two
      // words of the continuation line together ("circulated" + "by" -> "circulatedby").
      commit();
      current = [];
    }
    // `spaceAfter` describes the gap that follows a token, so the separator in front of this one
    // is read from its predecessor. Sourcing it from the current token would drop the last space
    // of every run and shift the rest one token late ("pad provided" -> "padprovided").
    const previous = tokens[index - 1];
    const spacing = current.length && previous?.spaceAfter ? " " : "";
    // The separator is appended to the previous run rather than pushed as its own, so a line
    // of uniformly styled text stays a single run instead of one per word.
    appendRun(current, { text: `${spacing}${token.text}`, bold: token.bold });
    width += (spacing ? spaceWidth : 0) + tokenWidth(token, fonts, size);
  }
  commit();
  return lines;
}

/** Lays out every block of a fragment, applying the shared body style. */
function layoutBlocks(
  blocks: RichBlock[],
  fonts: Fonts,
  size: number,
  leading: number,
  originX: number,
  limitX: number,
  gapBetween: number,
): Group[] {
  const groups: Group[] = [];
  blocks.forEach((block, index) => {
    if (block.table) {
      groups.push(...layoutTable(block.table, fonts, size, leading, originX, limitX));
      return;
    }
    const indent = originX + block.depth * NEST_INDENT;
    const textX = block.marker ? indent + MARKER_GAP : indent;
    const lines = layoutRuns(block.runs, fonts, size, textX, textX, limitX, block.marker);
    if (!lines.length) return;
    groups.push({
      height: lines.length * leading,
      lines,
      gapAfter: index === blocks.length - 1 ? 0 : gapBetween,
    });
  });
  return groups;
}

/** Distributes column widths from the widest natural cell, scaled down to the content width. */
function columnWidths(table: RichTable, fonts: Fonts, size: number, limitX: number, originX: number): number[] {
  const columns = table.rows.reduce((widest, row) => Math.max(widest, row.length), 1);
  const natural: number[] = [];
  for (let column = 0; column < columns; column += 1) {
    let widest = 0;
    table.rows.forEach((row, rowIndex) => {
      // A header cell is painted bold, so it has to be measured bold for the column to be
      // wide enough to hold it.
      const cell = table.headerRow && rowIndex === 0 ? boldedBlocks(row[column] ?? []) : row[column] ?? [];
      for (const block of cell) {
        if (block.table) continue;
        const lines = layoutRuns(block.runs, fonts, size, 0, 0, PROBE_WIDTH);
        let width = 0;
        for (const line of lines) width = Math.max(width, lineWidth(line, fonts, size));
        widest = Math.max(widest, width + CELL_PADDING * 2);
      }
    });
    natural.push(Math.max(48, Math.min(240, widest)));
  }
  const available = limitX - originX;
  const total = natural.reduce((sum, width) => sum + width, 0);
  if (total <= available) {
    // Distribute any slack so the table still spans the full content width.
    const extra = (available - total) / columns;
    return natural.map((width) => width + extra);
  }
  return natural.map((width) => (width / total) * available);
}

/** Lays out a borderless table: each row is one group, so rows never split across pages. */
function layoutTable(
  table: RichTable,
  fonts: Fonts,
  size: number,
  leading: number,
  originX: number,
  limitX: number,
): Group[] {
  const widths = columnWidths(table, fonts, size, limitX, originX);
  const groups: Group[] = [];

  table.rows.forEach((row, rowIndex) => {
    const cellLines: VisualLine[][] = [];
    let tallest = 0;
    // A header row is set bold, which has to happen before the cells are measured: the bold
    // face is wider, so a header measured in the regular face overflows its column and runs
    // into the text of the next one.
    const cells = table.headerRow && rowIndex === 0 ? row.map((cell) => boldedBlocks(cell)) : row;
    cells.forEach((cell, column) => {
      const cellWidth = widths[column] ?? 0;
      const x = originX + widths.slice(0, column).reduce((sum, width) => sum + width, 0) + CELL_PADDING;
      const blocks = cell ?? [];
      const lines: VisualLine[] = [];
      for (const block of blocks) {
        if (block.table) {
          lines.push(...flattenTableBlocks(block.table, fonts, size, x, x + cellWidth - CELL_PADDING));
          continue;
        }
        const indent = x + block.depth * NEST_INDENT;
        const textX = block.marker ? indent + MARKER_GAP : indent;
        lines.push(...layoutRuns(block.runs, fonts, size, textX, textX, x + cellWidth - CELL_PADDING, block.marker));
      }
      cellLines.push(lines.length ? lines : [{ runs: [{ text: "", bold: false }], x, marker: null }]);
      tallest = Math.max(tallest, lines.length * leading);
    });

    groups.push({
      height: tallest + CELL_PADDING,
      lines: cellLines.flat(),
      // Cells are transposed into one list per visual row so each column shares a baseline.
      rows: Array.from({ length: Math.max(...cellLines.map((lines) => lines.length)) }, (_, line) =>
        cellLines.map((lines) => lines[line] ?? { runs: [], x: 0, marker: null }),
      ),
      gapAfter: rowIndex === table.rows.length - 1 ? 0 : leading * 0.35,
    });
  });
  return groups;
}

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */

/**
 * Paints pre-measured groups onto pages, starting a new page whenever a group would
 * not fit. Running heads and footers are stamped after all content is placed, because
 * the page count is only known once drawing has finished.
 */
class Canvas {
  page: PDFPage;
  cursor: number;

  constructor(readonly document: PDFDocument, private readonly fonts: Fonts) {
    this.page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursor = CONTENT_TOP;
  }

  private breakPage(): void {
    this.page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursor = CONTENT_TOP;
  }

  /** Ensures `height` points are available, breaking the page if they are not. */
  reserve(height: number): void {
    if (this.cursor - height < CONTENT_BOTTOM) this.breakPage();
  }

  /**
   * Starts a new page unconditionally.
   *
   * `reserve` only breaks when the requested height does not fit, so passing the remaining
   * space leaves the cursor exactly on the boundary and keeps the same page; callers that
   * always want a fresh page need this instead.
   */
  breakToNewPage(): void {
    this.breakPage();
  }

  get remaining(): number {
    return this.cursor - CONTENT_BOTTOM;
  }

  space(amount: number): void {
    this.cursor -= amount;
  }

  drawGroup(group: Group, size: number, leading: number, color = INK): void {
    this.reserve(group.height);
    const lineCount = Math.max(1, Math.round(group.height / leading));
    for (let index = 0; index < lineCount; index += 1) {
      const baseline = this.cursor - size - index * leading;
      if (group.rows) {
        for (const line of group.rows[index] ?? []) this.drawLine(line, baseline, size, color, group.align);
        continue;
      }
      const line = group.lines[index];
      if (line) this.drawLine(line, baseline, size, color, group.align);
    }
    this.cursor -= group.height;
    this.cursor -= group.gapAfter;
  }

  /** Draws lines one at a time, breaking the page when one no longer fits. */
  drawLines(lines: VisualLine[], size: number, leading: number, color = INK, gapAfter = 0): void {
    for (const line of lines) {
      if (this.cursor - leading < CONTENT_BOTTOM) this.breakPage();
      const baseline = this.cursor - size;
      this.drawLine(line, baseline, size, color);
      this.cursor -= leading;
    }
    this.cursor -= gapAfter;
  }

  private drawLine(line: VisualLine, baseline: number, size: number, color: RGB, align?: "right" | "center"): void {
    let x = line.x;
    // Measuring a line is only needed to align it, so left-aligned lines skip the pass.
    if (align === "right") x = MARGIN_X + CONTENT_WIDTH - lineWidth(line, this.fonts, size);
    if (align === "center") x = MARGIN_X + (CONTENT_WIDTH - lineWidth(line, this.fonts, size)) / 2;
    if (line.marker) {
      // The marker sits in the hanging indent, to the left of the text it introduces.
      this.page.drawText(sanitizeText(line.marker), { x: Math.max(0, line.x - MARKER_GAP), y: baseline, size, font: this.fonts.regular, color });
    }
    for (const run of line.runs) {
      const font = run.bold ? this.fonts.bold : this.fonts.regular;
      if (run.text) this.page.drawText(run.text, { x, y: baseline, size, font, color });
      x += font.widthOfTextAtSize(run.text, size);
    }
  }

  /** Draws a single run of text at an absolute position, used for the title block. */
  drawAt(x: number, baseline: number, text: string, size: number, bold: boolean, color = INK): number {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    const safe = sanitizeText(text);
    this.page.drawText(safe, { x, y: baseline, size, font, color });
    return x + font.widthOfTextAtSize(safe, size);
  }

  /** Stamps the running head and page number onto every page. */
  finish(exam: PrintableExam): void {
    const pages = this.document.getPages();
    const font = this.fonts.regular;
    // Truncate before sanitising: a full title can be tens of thousands of characters.
    const head = sanitizeText(exam.title.slice(0, 90));
    const foot = `AFT · ${formatDuration(exam.totalDurationSeconds)}`;
    pages.forEach((page, index) => {
      const label = `${examTypeLabel(exam.examType)}  ·  Page ${index + 1} of ${pages.length}`;
      page.drawText(head, { x: MARGIN_X, y: PAGE_HEIGHT - 42, size: SMALL_SIZE, font, color: MUTED });
      page.drawText(label, { x: PAGE_WIDTH - MARGIN_X - font.widthOfTextAtSize(label, SMALL_SIZE), y: PAGE_HEIGHT - 42, size: SMALL_SIZE, font, color: MUTED });
      page.drawText(foot, { x: MARGIN_X, y: 40, size: SMALL_SIZE, font, color: MUTED });
    });
  }
}

/* ------------------------------------------------------------------ *
 * Document assembly
 * ------------------------------------------------------------------ */

type PdfOptions = { email?: PrintableEmail | null; attachments?: PrintableAttachment[] };

/** Draws the AFT logo on the opening page, at a fixed height and preserving aspect ratio. */
async function drawLogo(canvas: Canvas): Promise<void> {
  try {
    const image = await canvas.document.embedPng(Buffer.from(AFT_LOGO_BASE64, "base64"));
    const width = (LOGO_HEIGHT * image.width) / image.height;
    if (width <= CONTENT_WIDTH) {
      canvas.page.drawImage(image, { x: MARGIN_X, y: canvas.cursor - LOGO_HEIGHT, width, height: LOGO_HEIGHT });
      canvas.space(LOGO_HEIGHT);
    }
  } catch {
    // Branding is decorative; a missing or unreadable logo must not fail generation.
  }
}

/** Renders the aligned exam type, title and duration block. */
function drawCoverBlock(canvas: Canvas, exam: PrintableExam, fonts: Fonts): void {
  canvas.reserve(TITLE_LEADING * 2 + H1_LEADING * 2);
  const type = examTypeLabel(exam.examType).toUpperCase();
  const duration = formatDuration(exam.totalDurationSeconds);

  canvas.space(6);
  canvas.drawAt(MARGIN_X, canvas.cursor - TITLE_SIZE, type, 11, true, MUTED);
  canvas.space(TITLE_LEADING * 0.55);

  // The title and the duration share a baseline grid: the title starts at the left margin
  // and the duration is right-aligned to the same line, so both stay aligned to the columns.
  const titleLines = layoutRuns(
    [{ text: exam.title, bold: true }],
    fonts,
    TITLE_SIZE,
    MARGIN_X,
    MARGIN_X,
    MARGIN_X + CONTENT_WIDTH,
  );
  for (const line of titleLines) {
    canvas.reserve(TITLE_LEADING);
    canvas.drawLines([line], TITLE_SIZE, TITLE_LEADING);
  }
  canvas.space(4);
  canvas.drawAt(MARGIN_X, canvas.cursor - H1_SIZE, `Time allowed: ${duration}`, H1_SIZE, false, MUTED);
  canvas.space(H1_LEADING * 0.9);
}

/** Renders a heading, keeping it attached to the first group of the block that follows. */
function drawHeading(canvas: Canvas, text: string, fonts: Fonts, size = H1_SIZE, leading = H1_LEADING): void {
  const lines = layoutRuns([{ text, bold: true }], fonts, size, MARGIN_X, MARGIN_X, MARGIN_X + CONTENT_WIDTH);
  canvas.reserve(leading);
  canvas.drawLines(lines, size, leading);
}

/** Renders a body fragment, or nothing when the fragment is empty. */
function drawFragment(
  canvas: Canvas,
  fonts: Fonts,
  text: string | null | undefined,
  size = BODY_SIZE,
  leading = BODY_LEADING,
  gapAfter = 0,
  bold = false,
): void {
  if (!text) return;
  const parsed = parseRichHtml(text);
  if (!parsed.length) return;
  // Emphasis is applied to the runs before layout, never after it: painting a line in a wider
  // face than the one it was wrapped against pushes it past the margin and out of alignment.
  const blocks = bold ? boldedBlocks(parsed) : parsed;
  const groups = layoutBlocks(blocks, fonts, size, leading, MARGIN_X, MARGIN_X + CONTENT_WIDTH, leading * 0.45);
  groups.forEach((group, index) => {
    canvas.drawGroup(group, size, leading, INK);
    if (index === groups.length - 1) canvas.space(gapAfter);
  });
}

/**
 * Renders the email header: a bold, muted label followed by the value on the same baseline.
 *
 * The values stay in the regular face. Setting a whole email block bold flattened every
 * distinction in it, so the header read as one slab of text and the message body lost the
 * emphasis the author actually applied.
 */
function drawEmail(canvas: Canvas, email: PrintableEmail, fonts: Fonts): void {
  const rows: [string, string | null | undefined][] = [
    ["From", email.from],
    ["To", email.to],
    ["Subject", email.subject],
  ];
  const present = rows.filter(([, value]) => value);
  if (!present.length) return;
  const labelSize = SMALL_SIZE + 1.5;
  const labelWidth = Math.max(...present.map(([label]) => fonts.bold.widthOfTextAtSize(label, labelSize))) + 8;

  for (const [label, value] of present) {
    canvas.reserve(BODY_LEADING);
    const baseline = canvas.cursor - BODY_SIZE;
    canvas.drawAt(MARGIN_X, baseline, label, labelSize, true, MUTED);
    canvas.drawAt(MARGIN_X + labelWidth, baseline, value!, BODY_SIZE, false, INK);
  }
  canvas.space(BODY_LEADING * 0.4);
  drawFragment(canvas, fonts, email.html, BODY_SIZE, BODY_LEADING, BODY_LEADING * 0.8);
}

/** A decoded attachment image, or null when the attachment is not an image the writer can embed. */
type EmbeddedImage = { draw: (x: number, y: number, width: number, height: number) => void; width: number; height: number };

/** True when `bytes` begin with a PNG signature, which is the only lossless image pdf-lib writes. */
export function isPngBytes(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

/** True when `bytes` begin with the JPEG start-of-image marker. */
export function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

/**
 * Decodes an attachment as a PNG or JPEG.
 *
 * The bytes are sniffed rather than trusted from the key or the stored content type: an upload
 * stored under a key that does not end in an image extension, or served with a generic
 * `application/octet-stream`, is still a perfectly good picture and must reach the page.
 */
async function embedAttachmentImage(canvas: Canvas, attachment: PrintableAttachment): Promise<EmbeddedImage | null> {
  const body = attachment.base64 ?? "";
  if (!body) return null;
  const mime = attachment.mimeType ?? "";
  const isPng = body.startsWith("iVBOR") || mime.includes("png");
  const isJpeg = body.startsWith("/9j/") || mime.includes("jpeg") || mime.includes("jpg");
  if (!isPng && !isJpeg) return null;
  try {
    const bytes = Buffer.from(body, "base64");
    const image = isPng ? await canvas.document.embedPng(bytes) : await canvas.document.embedJpg(bytes);
    return { width: image.width, height: image.height, draw: (x, y, width, height) => canvas.page.drawImage(image, { x, y, width, height }) };
  } catch {
    // Undecodable bytes: the caller falls back to printing the caption.
    return null;
  }
}

/**
 * Renders one attachment and reports whether the image itself made it onto the page.
 *
 * The caption is always printed — for a non-image file it is the only representation of the
 * attachment — and it travels with the image when the image is too tall for the space left and
 * has to move to a fresh page, so no page ends up as a picture with nothing to identify it.
 */
async function drawAttachment(
  canvas: Canvas,
  fonts: Fonts,
  attachment: PrintableAttachment,
  caption = attachment.title,
): Promise<boolean> {
  const captionSize = SMALL_SIZE + 1;
  const printCaption = () => drawFragment(canvas, fonts, caption, captionSize, BODY_LEADING, BODY_LEADING * 0.3);

  const image = await embedAttachmentImage(canvas, attachment);
  if (!image) {
    printCaption();
    return false;
  }

  // The size an image gets when it is allowed the whole content box.
  const fullScale = Math.min(CONTENT_WIDTH / image.width, MAX_IMAGE_HEIGHT / image.height, 1);
  const fullWidth = image.width * fullScale;
  const fullHeight = image.height * fullScale;
  const captionHeight = caption ? BODY_LEADING * 1.3 : 0;
  // Squeezing an image into a sliver of leftover page makes it unreadable, so an image that does
  // not already fit is moved to a fresh page unless enough usable room remains.
  const ownPage = fullHeight + captionHeight > canvas.remaining && canvas.remaining < MIN_INLINE_IMAGE_HEIGHT + captionHeight;

  if (ownPage) {
    canvas.breakToNewPage();
    if (caption) printCaption();
    image.draw(MARGIN_X, canvas.cursor - fullHeight, fullWidth, fullHeight);
    canvas.space(fullHeight);
    return true;
  }

  printCaption();
  const scale = Math.min(fullScale, Math.max(0, canvas.remaining) / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  image.draw(MARGIN_X, canvas.cursor - height, width, height);
  canvas.space(height);
  return true;
}

/**
 * Builds the printable exam PDF: an AFT-branded title block followed by one section per
 * task, with structured email panels, borderless tables and embedded attachment images.
 */
export async function generateBrandedPrintablePdf(
  exam: PrintableExam,
  sections: PrintableSection[],
  options: PdfOptions = {},
): Promise<Buffer> {
  const document = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  const canvas = new Canvas(document, fonts);

  await drawLogo(canvas);
  drawCoverBlock(canvas, exam, fonts);

  if (exam.intro) {
    drawFragment(canvas, fonts, exam.intro, BODY_SIZE + 1, BODY_LEADING + 1, BODY_LEADING * 0.6);
  }

  const attachments = options.attachments ?? [];
  if (options.email) drawEmail(canvas, options.email, fonts);

  if (attachments.length) {
    drawHeading(canvas, "Attachments", fonts, H2_SIZE, H2_LEADING);
    for (const attachment of attachments) {
      await drawAttachment(canvas, fonts, attachment);
      canvas.space(BODY_LEADING * 0.3);
    }
  }

  for (const section of sections) {
    canvas.reserve(H1_LEADING * 3);
    canvas.space(BODY_LEADING * 0.5);
    drawHeading(canvas, `Section ${section.sectionNumber} · ${section.title}`, fonts);
    drawFragment(canvas, fonts, `Time allowed: ${formatDuration(section.durationSeconds)}`, SMALL_SIZE + 1, BODY_LEADING, BODY_LEADING * 0.5);
    drawFragment(canvas, fonts, section.introduction);
    // The instruction sheet is read with the instructions, so it prints before the extra notes
    // and the task itself rather than being held back with the other attachments.
    for (const title of section.introAttachmentTitles ?? []) {
      canvas.space(BODY_LEADING * 0.3);
      drawFragment(canvas, fonts, title, SMALL_SIZE + 1, BODY_LEADING, 0);
    }
    for (const attachment of section.introAttachments ?? []) {
      await drawAttachment(canvas, fonts, attachment);
      canvas.space(BODY_LEADING * 0.3);
    }
    drawFragment(canvas, fonts, section.scenario);
    if (section.question) {
      canvas.space(BODY_LEADING * 0.3);
      drawFragment(canvas, fonts, section.question);
    }
    if (section.email) {
      canvas.space(BODY_LEADING * 0.3);
      drawEmail(canvas, section.email, fonts);
    }
    for (const title of section.attachmentTitles ?? []) {
      drawFragment(canvas, fonts, title, SMALL_SIZE + 1, BODY_LEADING, 0);
    }
    for (const attachment of section.attachments ?? []) {
      await drawAttachment(canvas, fonts, attachment);
      canvas.space(BODY_LEADING * 0.3);
    }
  }

  canvas.finish(exam);
  // Metadata is truncated because a title may be arbitrarily long authored content.
  document.setTitle(sanitizeText(exam.title.slice(0, 200)));
  document.setCreator("AFT Learning Portal");
  return Buffer.from(await document.save());
}
