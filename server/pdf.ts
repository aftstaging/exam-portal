import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { parseRichHtml as parseSharedRichHtml, type RichAlign, type RichBlockKind as SharedBlockKind } from "@shared/richText";
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

/**
 * A contiguous stretch of text that shares one emphasis state.
 *
 * Italic, underline and strike-through are carried through to the page: a face is embedded for
 * each, so unlike the previous two-face setup an underlined word in an authored question prints
 * underlined instead of as plain text.
 */
type RichRun = { text: string; bold: boolean; italic?: boolean; underline?: boolean; strike?: boolean };

/** One renderable block: `marker` is the list marker drawn in the hanging indent, `depth` the nesting level. */
type RichBlock = {
  marker: string | null;
  depth: number;
  runs: RichRun[];
  /** Author alignment. `left` is the default, so an unset value means left. */
  align?: RichAlign;
  kind?: SharedBlockKind;
  level?: number;
  table?: RichTable;
};

/** An HTML table: rows of cells, each cell holding its own nested blocks. */
type RichTable = { rows: RichBlock[][][]; headerRow: boolean };

/**
 * Parses author-supplied content into the block model this file draws.
 *
 * The grammar lives in `shared/richText` and is shared with the on-screen renderer, so a
 * paragraph, list or table means the same thing in both. This adapter only re-shapes the result
 * for the layout code below, and adds the one thing the page needs and the screen does not: runs
 * are trimmed of surrounding whitespace and separated by exactly one space at draw time, which is
 * what keeps a word split across an emphasis boundary (`total<b>cost</b>ing`) joined on the page
 * instead of acquiring a space in the middle of it.
 */
export function parseRichHtml(html: string | null | undefined): RichBlock[] {
  return adaptBlocks(parseSharedRichHtml(html));
}

function adaptBlocks(blocks: ReturnType<typeof parseSharedRichHtml>): RichBlock[] {
  const out: RichBlock[] = [];
  for (const block of blocks) {
    // A horizontal rule carries no text the page can draw, so it is dropped here rather than
    // laid out as an empty line.
    if (block.kind === "rule") continue;
    if (block.table) {
      out.push({
        marker: null,
        depth: 0,
        runs: [],
        align: block.align,
        kind: "table",
        table: { rows: block.table.rows.map((row) => row.map((cell) => adaptBlocks(cell))), headerRow: block.table.headerRow },
      });
      continue;
    }
    // A hard line break ends a line on the page but not a paragraph on screen, so the split
    // happens here rather than in the shared parser: the exam shell renders the newline as a
    // <br> inside one paragraph, and the sheet draws each piece as its own measured line.
    for (const piece of splitOnHardBreaks(block)) {
      const runs = spacedRuns(piece.runs);
      if (!runs.length) continue;
      out.push({
        marker: piece.marker,
        depth: block.depth,
        runs,
        align: block.align,
        kind: block.kind,
        level: block.level,
      });
    }
  }
  return out;
}

/**
 * Splits a block's runs at every hard line break.
 *
 * The marker is given to the first piece only, matching the rule that a list marker belongs to
 * the line it opens rather than being repeated down the item.
 */
function splitOnHardBreaks(block: { runs: RichRun[]; marker: string | null }): { runs: RichRun[]; marker: string | null }[] {
  if (!block.runs.some((run) => run.text.includes("\n"))) return [{ runs: block.runs, marker: block.marker }];
  const pieces: { runs: RichRun[]; marker: string | null }[] = [];
  let current: RichRun[] = [];
  let marker = block.marker;
  for (const run of block.runs) {
    const segments = run.text.split("\n");
    segments.forEach((segment, index) => {
      if (index > 0) {
        pieces.push({ runs: current, marker });
        current = [];
        marker = null;
      }
      if (segment) current.push({ ...run, text: segment });
    });
  }
  pieces.push({ runs: current, marker });
  return pieces;
}

/**
 * Collapses the collected runs into whole words, merging neighbours that share an emphasis state.
 *
 * Runs are stored without leading or trailing whitespace, so a single space is re-inserted
 * between runs at draw time. Words split across an emphasis boundary (`total<b>cost</b>ing`)
 * therefore stay joined in the output even though they are separate runs.
 */
function spacedRuns(runs: RichRun[]): RichRun[] {
  const out: RichRun[] = [];
  // Tracks whether a whitespace run preceded the current token: a continuation inside a
  // single word is rejoined without a space, while a genuinely new word gets one.
  let space = false;
  let emitted = false;

  for (const run of runs) {
    for (const piece of run.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        space = emitted;
        continue;
      }
      const previous = out[out.length - 1];
      if (previous && sameStyle(previous, run)) previous.text += `${space ? " " : ""}${piece}`;
      // A run that carries no emphasis beyond bold is written with only `text` and `bold`, so
      // an unemphasised run is indistinguishable from the shape the layout code has always
      // used and no optional flag is carried around for nothing.
      else out.push(emphasis(run) ? { ...run, text: `${space ? " " : ""}${piece}` } : { text: `${space ? " " : ""}${piece}`, bold: run.bold });
      emitted = true;
      space = false;
    }
  }
  return out;
}

/** True when the run asks for more than the bold face. */
function emphasis(run: RichRun): boolean {
  return !!(run.italic || run.underline || run.strike);
}

/** Two runs may be merged only when every emphasis flag matches, not just bold. */
function sameStyle(a: RichRun, b: RichRun): boolean {
  return a.bold === b.bold && !!a.italic === !!b.italic && !!a.underline === !!b.underline && !!a.strike === !!b.strike;
}

/* ------------------------------------------------------------------ *
 * Page geometry
 *
 * The sheet is a monochrome A4 page with no decorative rules, matching the reference document;
 * the only lines drawn are the borders of an authored table, which is what makes a data table
 * legible as a table on paper. Width is an integer so page size comparisons are exact.
 * ------------------------------------------------------------------ */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 56.7;
const CONTENT_TOP = PAGE_HEIGHT - 62;
const CONTENT_BOTTOM = 62;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const CONTENT_HEIGHT = CONTENT_TOP - CONTENT_BOTTOM;

/**
 * One type scale, used for everything the sheet prints.
 *
 * The sizes used to be written as `SMALL_SIZE + 1`, `SMALL_SIZE + 1.5` and `BODY_SIZE + 1` at the
 * call sites, which is how a sheet ended up with nine different sizes on it and the same line of
 * text — "Time allowed" — printed at 15pt under the title and at 9pt inside a section. Every size
 * on the page is now one of these steps, so the hierarchy is legible as a hierarchy.
 */
const TITLE_SIZE = 22;
const TITLE_LEADING = 27;
const H1_SIZE = 13.5;
const H1_LEADING = 18;
const H2_SIZE = 11.5;
const H2_LEADING = 15.5;
const H3_SIZE = 11;
const BODY_SIZE = 10.5;
const BODY_LEADING = 15;
/** The duration under a title, and the labels of an email header. */
const META_SIZE = 9.5;
/** A sheet's leading, and the caption that identifies an attachment. */
const CAPTION_SIZE = 9;
const CAPTION_LEADING = 12.5;
/** Running head and foot. */
const RUNNING_SIZE = 8;
/** Baseline grid of the email header rows, and of a caption line. */
const ROW_LEADING = 13.5;
const CAPTION_GAP = 5;

/** Gap between a list marker and the text it introduces, whatever the marker is. */
const MARKER_GAP = 5;
const NEST_INDENT = 14;
const CELL_PADDING = 5;
const LOGO_HEIGHT = 42;

/**
 * The frame every attachment image is fitted into.
 *
 * Attachments used to be drawn at whatever size they happened to be, so a chart arrived on the
 * page at 300pt wide beside another that filled the column at 420pt and the sheet read as though
 * the two documents had been printed by different people. Each image is now fitted to the same box
 * and centred in the column, so the differences that remain are the shape of the documents rather
 * than the size of them.
 */
const ATTACHMENT_BOX_HEIGHT = 300;
/**
 * A source larger than this is not magnified further, because upscaling a screenshot goes soft.
 *
 * There is deliberately no floor on the scale. A minimum scale was the reason two attachments of
 * the same shape reached the paper at different sizes: the larger one could not be scaled down as
 * far as the frame asked, so the floor overrode the fit and printed it *taller than the box* while
 * the smaller one fitted exactly. Only the magnification ceiling remains, which cannot put an image
 * outside the frame.
 */
const ATTACHMENT_MAX_SCALE = 1.5;
/** Layout probe width used to measure a single unwrapped line of table cell text. */
const PROBE_WIDTH = 10_000;
/**
 * How far short of the right margin the sheet keeps its text.
 *
 * The slack of a justified line is shared between its gaps, and the sum of the pieces a run was
 * split into measures a fraction of a point wider than the run was measured as. The same drift
 * applies to a line wrapped to fill the measure: a line that measured as fitting exactly printed a
 * hair past the margin, and — having no slack left to share — silently fell out of justification
 * altogether. Wrapping and justification both stop this far short of the margin, so the flush edge
 * stays flush and no line is denied its stretch over a rounding error.
 */
const JUSTIFY_INSET = 1;

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

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
};

/**
 * Picks the face for a run.
 *
 * The four standard faces are tiny — a WinAnsi Helvetica is a few kilobytes — and the italic
 * face in particular is what turns an emphasised word on the page into an emphasised word
 * rather than an indistinguishable one.
 */
function fontFor(run: RichRun, fonts: Fonts): PDFFont {
  if (run.bold) return run.italic ? fonts.boldItalic : fonts.bold;
  return run.italic ? fonts.italic : fonts.regular;
}

/** A word-sized chunk of text plus whether a space separates it from the previous chunk. */
type Token = { text: string; bold: boolean; italic?: boolean; underline?: boolean; strike?: boolean; spaceAfter: boolean };

/**
 * One physical line: the runs to paint, the x to start at, and an optional list marker.
 *
 * `markerIndent` is the width of the marker plus the gap after it, measured from the marker itself
 * rather than assumed, so a bullet hangs the same distance from its text as a number does. A fixed
 * indent left a bullet floating 10pt clear of the words it introduced.
 *
 * `justify` marks a line that is not the last of its paragraph, so it is the only kind of line
 * that gets its word spacing stretched out to reach the right margin.
 */
type VisualLine = { runs: RichRun[]; x: number; marker: string | null; markerIndent: number; justify?: boolean };

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
 * `size`/`leading` override the fragment's for a block that sets its own, which is how an
 * authored heading keeps its larger measure without dragging the body text up with it.
 * `grid` describes the rules to draw around a table row.
 */
type Group = {
  height: number;
  lines: VisualLine[];
  rows?: VisualLine[][];
  gapAfter: number;
  /** Space reserved above the group, which is how a heading separates from the text before it. */
  gapBefore?: number;
  align?: "right" | "center";
  size?: number;
  leading?: number;
  grid?: TableGrid;
};

/** The rules drawn around one laid-out table row. */
type TableGrid = { edges: number[]; first: boolean; last: boolean };

/** Width of a laid-out line, including the hanging indent its list marker occupies. */
function lineWidth(line: VisualLine, fonts: Fonts, size: number): number {
  let width = 0;
  for (const run of line.runs) {
    width += fontFor(run, fonts).widthOfTextAtSize(run.text, size);
  }
  return width + line.markerIndent;
}

/**
 * The distance a list item's text sits from the left margin: its marker, then the gap after it.
 *
 * Measured rather than assumed, because a bullet and an ordinal are not the same width and a single
 * constant put one of them either hard against its text or floating clear of it.
 */
function markerIndent(marker: string, fonts: Fonts, size: number): number {
  return fonts.regular.widthOfTextAtSize(sanitizeText(marker), size) + MARKER_GAP;
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
    if (rowIndex < table.rows.length - 1) lines.push({ runs: [{ text: "", bold: false }], x, marker: null, markerIndent: 0 });
  });
  return lines;
}

function splitRuns(runs: RichRun[]): Token[] {
  const tokens: Token[] = [];
  runs.forEach((run) => {
    for (const piece of run.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        if (tokens.length) tokens[tokens.length - 1]!.spaceAfter = true;
        continue;
      }
      // The gap between two words is read from the run text itself, where the author put it, and
      // is never inferred from the fact that one run ended and another began. An earlier version
      // assumed runs carried no surrounding whitespace and inserted a space at every run
      // boundary to compensate, which printed "total cost ing" for a field reading
      // "total<b>cost</b>ing" — the very markup that means one word.
      const safe = sanitizeText(piece);
      if (safe) tokens.push({ text: safe, bold: run.bold, italic: run.italic, underline: run.underline, strike: run.strike, spaceAfter: false });
    }
  });
  return tokens;
}

function tokenWidth(token: Token, fonts: Fonts, size: number): number {
  return fontFor(token, fonts).widthOfTextAtSize(token.text, size);
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
  const font = fontFor(token, fonts);
  const text = token.text;
  // A split word keeps the emphasis of the whole it came from, so a long bold word stays bold
  // across every chunk instead of reverting to the regular face mid-word.
  const style = { bold: token.bold, italic: token.italic, underline: token.underline, strike: token.strike };
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
      pieces.push({ ...style, text: text.slice(index), spaceAfter: false });
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
        pieces.push({ ...style, text: slice, spaceAfter: false });
        index += slice.length;
        continue;
      }
      slice = grown;
    }
    pieces.push({ ...style, text: slice, spaceAfter: false });
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
  if (last && sameStyle(last, run)) last.text += run.text;
  // The run is spread rather than rebuilt field by field: naming only `bold` here would drop
  // the underline and italic of every non-bold run on the page.
  else lines.push({ ...run });
}

/**
 * Wraps runs into lines, indenting the first line and continuations independently.
 *
 * `justify` asks for the body style: every line except the last of the paragraph is marked for
 * stretching to the right margin. Titles, headings and table cells leave it off, because a
 * stretched heading or a stretched table cell reads as a mistake rather than as alignment.
 */
function layoutRuns(
  runs: RichRun[],
  fonts: Fonts,
  size: number,
  firstX: number,
  contX: number,
  limitX: number,
  marker: string | null = null,
  justify = false,
): VisualLine[] {
  const tokens: Token[] = [];
  for (const token of splitRuns(runs)) tokens.push(token);
  if (!tokens.length) return [];

  const spaceWidth = fonts.regular.widthOfTextAtSize(" ", size);
  // Wrapped short of the measure by the same inset justification stops short by, so a line that
  // measures as filling the column still has slack to share and still prints inside the margin.
  const hardLimit = limitX - JUSTIFY_INSET;
  const lines: VisualLine[] = [];
  let current: RichRun[] = [];
  let width = 0;
  let indent = firstX;
  let indentUsed = false;
  let currentMarker = marker;
  const currentIndent = marker ? markerIndent(marker, fonts, size) : 0;

  const commit = () => {
    if (!current.length) return;
    lines.push({ runs: current, x: indent, marker: indentUsed ? null : currentMarker, markerIndent: indentUsed ? 0 : currentIndent });
    current = [];
    width = 0;
    indent = contX;
    indentUsed = true;
    currentMarker = null;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    // A word wider than the column is split so it can never overflow the margin.
    const column = hardLimit - contX;
    if (tokenWidth(token, fonts, size) > column) {
      for (const piece of breakLongToken(token, fonts, size, column)) {
        if (width > 0) commit();
        current = [];
        appendRun(current, { ...piece, text: piece.text });
        width = tokenWidth(piece, fonts, size);
        indent = contX;
        indentUsed = true;
        commit();
      }
      continue;
    }
    const lead = current.length && tokens[index - 1]?.spaceAfter ? spaceWidth : 0;
    if (current.length && indent + width + lead + tokenWidth(token, fonts, size) > hardLimit) {
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
    appendRun(current, { text: `${spacing}${token.text}`, bold: token.bold, italic: token.italic, underline: token.underline, strike: token.strike });
    width += (spacing ? spaceWidth : 0) + tokenWidth(token, fonts, size);
  }
  commit();
  // The line after the break is the last of the paragraph and stays ragged, which is what tells a
  // reader where the paragraph ended.
  if (justify) lines.forEach((line, index) => { if (index < lines.length - 1) line.justify = true; });
  return lines;
}

/** Consecutive horizontal spans across a row of column edges, used to draw table rules. */
function horizontalSpans(edges: number[]): [number, number][] {
  const spans: [number, number][] = [];
  for (let index = 0; index < edges.length - 1; index += 1) {
    spans.push([edges[index]!, edges[index + 1]!]);
  }
  return spans;
}

/**
 * The measure an authored heading is set at.
 *
 * Anchored to the same scale the sheet's own headings use rather than to a multiplier of whatever
 * size the surrounding fragment happens to be, because the previous multipliers set an `<h2>` in
 * body text at 12.6pt — a point and a half over the prose, which reads as body text that was made
 * slightly larger rather than as a heading. A heading inside a table cell is still scaled off the
 * cell, since a 13.5pt heading in a 60pt column would not fit.
 */
function headingMetrics(level: number, size: number, leading: number): { size: number; leading: number } {
  const ceiling = level <= 1 ? H1_SIZE : level === 2 ? H2_SIZE : H3_SIZE;
  const next = Math.min(size * (level <= 1 ? 1.4 : level === 2 ? 1.25 : 1.12), ceiling);
  return { size: next, leading: Math.max(leading, next * 1.3) };
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
    const heading = block.kind === "heading";
    const metrics = heading ? headingMetrics(block.level ?? 3, size, leading) : { size, leading };
    const indent = originX + block.depth * NEST_INDENT;
    const textX = block.marker ? indent + markerIndent(block.marker, fonts, size) : indent;
    // A heading is set in the bold face so an authored <h2> reads as a heading on paper rather
    // than as a slightly larger paragraph. The change is made here, before measuring, because
    // the bold face is wider and a heading measured in the regular face overflows its measure.
    const runs = heading ? block.runs.map((run) => ({ ...run, bold: true })) : block.runs;
    // Body prose is justified, which is what a word processor does to a paragraph and what the
    // sheet has always done. An author who picks centre or right gets that alignment instead,
    // and an author who explicitly picks left gets a ragged right margin: stretching a centred
    // heading or a right-aligned list reads as a mistake, not as alignment. Table cells are laid
    // out by `layoutTable`, which never asks for justification, so a stretched cell is not
    // possible here.
    const align = block.align;
    const justify = !heading && (align === undefined || align === "justify");
    const lines = layoutRuns(runs, fonts, metrics.size, textX, textX, limitX, block.marker, justify);
    if (!lines.length) return;
    groups.push({
      height: lines.length * metrics.leading,
      lines,
      align: align === "center" || align === "right" ? align : undefined,
      // A heading needs room above it as well as a larger measure: set flush against the paragraph
      // above, a bold run two points taller reads as an accident in the prose rather than as a
      // heading, which is what the authored `<h2>` used to look like.
      gapBefore: heading ? metrics.leading * 0.75 : 0,
      gapAfter: index === blocks.length - 1 ? 0 : gapBetween,
      size: heading ? metrics.size : undefined,
      leading: heading ? metrics.leading : undefined,
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
        // The marker is passed so a bulleted cell is measured against the column it is actually
        // drawn in; measured without its hanging indent it overflows the column by the indent.
        const lines = layoutRuns(block.runs, fonts, size, 0, 0, PROBE_WIDTH, block.marker);
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

/**
 * Lays out a bordered table: each row is one group, so rows never split across pages.
 *
 * The column edges are handed to the drawing stage as a `grid` rather than drawn here, because
 * a rule can only be drawn once the row's page and vertical extent are known, and those are
 * decided by `Canvas` at paint time.
 */
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
  // The edges are the column boundaries: the left margin, each column division, and the right
  // margin. They are derived from the same widths the text was measured against, so a rule
  // always lands on the gap between two columns rather than inside one.
  const edges = [originX];
  for (const width of widths) edges.push(edges[edges.length - 1]! + width);
  if (Math.abs(edges[edges.length - 1]! - limitX) > 0.5) edges.push(limitX);

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
        const textX = block.marker ? indent + markerIndent(block.marker, fonts, size) : indent;
        lines.push(...layoutRuns(block.runs, fonts, size, textX, textX, x + cellWidth - CELL_PADDING, block.marker));
      }
      cellLines.push(lines.length ? lines : [{ runs: [{ text: "", bold: false }], x, marker: null, markerIndent: 0 }]);
      tallest = Math.max(tallest, lines.length * leading);
    });

    groups.push({
      // The trailing `CELL_PADDING` on the height is the padding below the last line of the
      // tallest cell; the text is inset from the top rule by the same amount via the baseline.
      height: tallest + CELL_PADDING * 2,
      lines: cellLines.flat(),
      // Cells are transposed into one list per visual row so each column shares a baseline.
      rows: Array.from({ length: Math.max(...cellLines.map((lines) => lines.length)) }, (_, line) =>
        cellLines.map((lines) => lines[line] ?? { runs: [], x: 0, marker: null, markerIndent: 0 }),
      ),
      // Rows abut inside a bordered table; the rules separate them, and a gap here would put a
      // visible channel of white between every pair of rows.
      gapAfter: 0,
      grid: { edges, first: rowIndex === 0, last: rowIndex === table.rows.length - 1 },
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

  constructor(readonly document: PDFDocument, readonly fonts: Fonts) {
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

  /**
   * Marks the current page as used up without starting a new one.
   *
   * Content that fills the page itself, such as an embedded PDF page, leaves the cursor where the
   * page ended. Moving it to the bottom makes the next `reserve` break the page, so nothing is
   * drawn on top of it and no blank page is added at the end either.
   */
  markFilled(): void {
    this.cursor = CONTENT_BOTTOM;
  }

  get remaining(): number {
    return this.cursor - CONTENT_BOTTOM;
  }

  space(amount: number): void {
    this.cursor -= amount;
  }

  drawGroup(group: Group, size: number, leading: number, color = INK): void {
    const gapBefore = group.gapBefore ?? 0;
    this.reserve(group.height + gapBefore);
    const lineSize = group.size ?? size;
    const lineLeading = group.leading ?? leading;
    const lineCount = Math.max(1, Math.round(group.height / lineLeading));
    const top = this.cursor - gapBefore;
    for (let index = 0; index < lineCount; index += 1) {
      const baseline = top - lineSize - index * lineLeading;
      if (group.rows) {
        for (const line of group.rows[index] ?? []) this.drawLine(line, baseline, lineSize, color, group.align);
        continue;
      }
      const line = group.lines[index];
      if (line) this.drawLine(line, baseline, lineSize, color, group.align);
    }
    if (group.grid) this.drawGrid(group.grid, top, top - group.height, lineSize, color);
    this.cursor -= group.height + gapBefore;
    this.cursor -= group.gapAfter;
  }

  /**
   * Draws the rules that make a table read as a table.
   *
   * A table whose cells are separated only by whitespace is indistinguishable from a paragraph
   * of short lines once it is on paper, which is how an authored data table ended up looking
   * like a list. The rules are drawn as hairline rectangles rather than stroked lines because
   * `drawLine` on this canvas is reserved for text, and a hairline stays hairline at any
   * content scale.
   *
   * Each row is a separate group, so the top rule is drawn for every row and the bottom rule
   * only for the last: drawing both on every row would put a pair of rules in each gap between
   * rows and read as a double border.
   */
  private drawGrid(grid: TableGrid, top: number, bottom: number, size: number, color: RGB): void {
    const thickness = Math.max(0.5, size * 0.06);
    const half = thickness / 2;
    for (const x of grid.edges) {
      // The outer edges are drawn on the group's own box; the vertical runs the full row height
      // so a cell that wraps onto three lines is boxed on all three.
      this.rule(x - half, bottom, thickness, top - bottom, color);
    }
    if (grid.first) for (const [x0, x1] of horizontalSpans(grid.edges)) this.rule(x0, top - half, x1 - x0, thickness, color);
    if (grid.last) for (const [x0, x1] of horizontalSpans(grid.edges)) this.rule(x0, bottom - half, x1 - x0, thickness, color);
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

  /**
   * Stretches a line's word spacing so it reaches the right margin.
   *
   * This is what a word processor does to body text, and it is the difference between a page that
   * looks typeset and one where every line ends at a different place with lumpy gaps between some
   * words and none between others. The slack is shared evenly between the gaps.
   */
  private drawJustified(line: VisualLine, baseline: number, size: number, color: RGB): void {
    const gaps = line.runs.reduce((count, run) => count + (run.text.match(/ /g)?.length ?? 0), 0);
    const slack = MARGIN_X + CONTENT_WIDTH - JUSTIFY_INSET - (line.x + lineWidth(line, this.fonts, size));
    // A line with no gaps has nothing to stretch, and a line whose slack is far larger than its
    // gaps would open rivers down the page, so both are left ragged.
    if (!gaps || slack <= 0.5 || slack / gaps > size * 0.5) {
      this.paintLine(line, baseline, size, color, line.x);
      return;
    }
    if (line.marker) this.drawMarker(line, baseline, size, color);
    const extra = slack / gaps;
    let x = line.x;
    for (const run of line.runs) {
      const font = fontFor(run, this.fonts);
      const pieces = run.text.split(" ");
      for (let index = 0; index < pieces.length; index += 1) {
        // The space is painted as part of the piece that precedes it so the font matches, then
        // the shared slack is added on top of it.
        const last = index === pieces.length - 1;
        const text = last ? pieces[index]! : `${pieces[index]} `;
        if (text) this.page.drawText(text, { x, y: baseline, size, font, color });
        const width = font.widthOfTextAtSize(text, size);
        // The rule is drawn on the text only, never on the trailing space, so a justified
        // underlined paragraph shows a gap at each stretched word rather than a continuous bar.
        if (text.trim()) this.decorate(run, x, font.widthOfTextAtSize(text.trimEnd(), size), baseline, size, color);
        x += width;
        if (!last) x += extra;
      }
    }
  }

  /**
   * Draws a hairline rule, used for table borders and for underline and strike-through.
   *
   * Drawn as a filled rectangle rather than a stroked line, because a stroke thins out with the
   * content scale while a filled rectangle stays a hairline at any size. The target page is
   * overridable so the running matter can be ruled onto finished pages.
   */
  private rule(x: number, y: number, width: number, thickness: number, color: RGB, page: PDFPage = this.page): void {
    if (width <= 0) return;
    page.drawRectangle({ x, y, width, height: thickness, color });
  }

  /**
   * Draws the decorative strokes an emphasis implies.
   *
   * Underline and strike-through cannot come from a font here: the embedded standard faces carry
   * no underline, and drawing a glyph from another face just to get the rule underneath it would
   * mismatch the text above. A rectangle under the run's own measured width is exact, and is
   * drawn per run so a bold word is underlined in the bold face's width rather than the regular
   * face's, which is what keeps the rule inside the column a long word was measured against.
   */
  private decorate(run: RichRun, x: number, width: number, baseline: number, size: number, color: RGB): void {
    const thickness = Math.max(0.4, size * 0.055);
    if (run.underline) this.rule(x, baseline - size * 0.13, width, thickness, color);
    if (run.strike) this.rule(x, baseline + size * 0.26, width, thickness, color);
  }

  /** Paints a line's runs left to right from `startX`, advancing by each run's own width. */
  private paintLine(line: VisualLine, baseline: number, size: number, color: RGB, startX: number): void {
    let x = startX;
    for (const run of line.runs) {
      const font = fontFor(run, this.fonts);
      if (run.text) this.page.drawText(run.text, { x, y: baseline, size, font, color });
      const width = font.widthOfTextAtSize(run.text, size);
      this.decorate(run, x, width, baseline, size, color);
      x += width;
    }
  }

  /** Draws one laid-out line at `baseline`, justifying or aligning it as the line asks. */
  drawLine(line: VisualLine, baseline: number, size: number, color: RGB, align?: "right" | "center"): void {
    if (line.justify) {
      this.drawJustified(line, baseline, size, color);
      return;
    }
    let x = line.x;
    // Measuring a line is only needed to align it, so left-aligned lines skip the pass.
    if (align === "right") x = MARGIN_X + CONTENT_WIDTH - lineWidth(line, this.fonts, size);
    if (align === "center") x = MARGIN_X + (CONTENT_WIDTH - lineWidth(line, this.fonts, size)) / 2;
    if (line.marker) this.drawMarker(line, baseline, size, color);
    this.paintLine(line, baseline, size, color, x);
  }

  /**
   * Draws a list marker in the hanging indent, to the left of the text it introduces.
   *
   * The marker is placed by its own measured width rather than by a constant, so the gap between it
   * and the first word is the same whether the marker is a bullet or an ordinal.
   */
  private drawMarker(line: VisualLine, baseline: number, size: number, color: RGB): void {
    this.page.drawText(sanitizeText(line.marker!), { x: Math.max(0, line.x - line.markerIndent), y: baseline, size, font: this.fonts.regular, color });
  }

  /** Draws a hairline across the full content width at `y`. */
  hairline(y: number, thickness = 0.5, color = INK): void {
    this.rule(MARGIN_X, y, CONTENT_WIDTH, thickness, color);
  }

  /** Draws a single run of text at an absolute position, used for the title block. */
  drawAt(x: number, baseline: number, text: string, size: number, bold: boolean, color = INK): number {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    const safe = sanitizeText(text);
    this.page.drawText(safe, { x, y: baseline, size, font, color });
    return x + font.widthOfTextAtSize(safe, size);
  }

  /**
   * Stamps the running head and page number onto every page.
   *
   * The head is set on a rule and the foot below another, so the running matter reads as furniture
   * around the content rather than as two more lines of text on the page. Both sit outside the
   * content box, which is why they are stamped here rather than laid out with everything else: the
   * page count is only known once drawing has finished.
   */
  finish(exam: PrintableExam): void {
    const pages = this.document.getPages();
    const font = this.fonts.regular;
    // Truncate before sanitising: a full title can be tens of thousands of characters.
    const head = sanitizeText(exam.title.slice(0, 90));
    const foot = `AFT · ${formatDuration(exam.totalDurationSeconds)}`;
    const headY = PAGE_HEIGHT - 42;
    const footY = 40;
    pages.forEach((page, index) => {
      const label = `${examTypeLabel(exam.examType)}  ·  Page ${index + 1} of ${pages.length}`;
      page.drawText(head, { x: MARGIN_X, y: headY, size: RUNNING_SIZE, font, color: MUTED });
      page.drawText(label, { x: PAGE_WIDTH - MARGIN_X - font.widthOfTextAtSize(label, RUNNING_SIZE), y: headY, size: RUNNING_SIZE, font, color: MUTED });
      page.drawText(foot, { x: MARGIN_X, y: footY, size: RUNNING_SIZE, font, color: MUTED });
      // The rules go straight onto the page rather than through the cursor, which belongs to the
      // content flow and is long since finished with by the time this runs.
      this.rule(MARGIN_X, headY - 8, CONTENT_WIDTH, 0.4, MUTED, page);
      this.rule(MARGIN_X, footY + 14, CONTENT_WIDTH, 0.4, MUTED, page);
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
  canvas.reserve(TITLE_LEADING * 2 + ROW_LEADING + BODY_LEADING);
  const type = examTypeLabel(exam.examType).toUpperCase();
  const duration = formatDuration(exam.totalDurationSeconds);

  canvas.space(6);
  canvas.drawAt(MARGIN_X, canvas.cursor - META_SIZE, type, META_SIZE, true, MUTED);
  canvas.space(TITLE_LEADING * 0.4);

  // The title starts at the left margin and the duration sits on the same baseline grid beneath
  // it, so both stay aligned to the columns the body text is set in.
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
  canvas.space(2);
  // The duration is meta, not a heading: it used to print at the size of a section title, which is
  // how the same sentence appeared at 15pt here and at 9pt under every section.
  canvas.drawAt(MARGIN_X, canvas.cursor - META_SIZE, `Time allowed: ${duration}`, META_SIZE, false, MUTED);
  canvas.space(ROW_LEADING * 0.5);
  // A rule closes the title block, so the introduction below it reads as a new band of content
  // rather than as a continuation of the title.
  canvas.hairline(canvas.cursor);
  canvas.space(BODY_LEADING * 0.6);
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
  // Paragraphs are separated by more than a fraction of the leading: at this measure two
  // consecutive paragraphs run together and the reader loses the break between them.
  const groups = layoutBlocks(blocks, fonts, size, leading, MARGIN_X, MARGIN_X + CONTENT_WIDTH, leading * 0.6);
  groups.forEach((group, index) => {
    canvas.drawGroup(group, size, leading, INK);
    if (index === groups.length - 1) canvas.space(gapAfter);
  });
}

/**
 * Renders an email: a header of `From`/`To`/`Subject` rows, then the message body.
 *
 * The rows are stacked on a shared baseline grid, one per line. They used to be drawn on a single
 * baseline, so the labels and every value were printed on top of one another and the header was
 * unreadable: `From` and the sender's address crossed out the same 8pt of page as `To` and the
 * recipient's. The labels are a fixed-width column, so the values line up under one another
 * whichever order the header arrives in and however long the addresses are.
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

  // One column, one measure: the widest label decides where every value starts, so the three
  // values are flush with one another rather than each starting a few points to the left.
  const labelWidth = Math.max(...present.map(([label]) => fonts.bold.widthOfTextAtSize(label, META_SIZE))) + 10;
  const valueX = MARGIN_X + labelWidth;

  for (const [label, value] of present) {
    canvas.reserve(ROW_LEADING);
    const baseline = canvas.cursor - META_SIZE;
    canvas.drawAt(MARGIN_X, baseline, label, META_SIZE, true, MUTED);
    // A long address or subject is wrapped in its own column rather than run past the right
    // margin, which is what a value longer than the measure used to do.
    canvas.drawLines(
      layoutRuns([{ text: value!, bold: false }], fonts, BODY_SIZE, valueX, valueX, MARGIN_X + CONTENT_WIDTH),
      BODY_SIZE,
      ROW_LEADING,
    );
  }
  canvas.space(CAPTION_GAP);
  canvas.hairline(canvas.cursor);
  canvas.space(CAPTION_GAP);
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

/** True when `bytes` begin with a PDF signature. */
export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/**
 * Prints a PDF attachment into the document as real pages and reports how many were added.
 *
 * The pages are added at the point in the document where the attachment is being drawn, so a
 * reference sheet stays with the section that cites it instead of being banished to the back.
 *
 * Each page is embedded as a page object rather than re-rendered into a picture, so the source's
 * own typography, charts and images survive exactly. A rasterised page would come out soft at print
 * size, which is the opposite of what an attached reference is for.
 */
async function drawPdfAttachmentPages(canvas: Canvas, attachment: PrintableAttachment, caption: string | null): Promise<number> {
  const body = attachment.base64 ?? "";
  if (!body) return 0;
  try {
    const source = await PDFDocument.load(Buffer.from(body, "base64"), { ignoreEncryption: true });
    let added = 0;
    for (const page of source.getPages()) {
      const embedded = await canvas.document.embedPage(page);
      // The caption goes at the head of the first page, above the sheet it names. Printed before
      // the page break it was left behind at the foot of the text page, so the sheet arrived with
      // its name a page behind it and a page that began with a picture nothing introduced.
      if (added === 0 && caption) {
        canvas.breakToNewPage();
        drawAttachmentCaption(canvas, canvas.fonts, caption);
      } else {
        canvas.breakToNewPage();
      }
      // Scaled to sit inside the printable content box, so a source page larger than the sheet or
      // of a different shape is never clipped by it.
      const scale = Math.min(CONTENT_WIDTH / embedded.width, (canvas.remaining - 4) / embedded.height, 1);
      const width = embedded.width * scale;
      const height = embedded.height * scale;
      canvas.page.drawPage(embedded, {
        x: MARGIN_X + (CONTENT_WIDTH - width) / 2,
        y: canvas.cursor - height,
        width,
        height,
      });
      canvas.space(height);
      added += 1;
    }
    // The embedded page occupies the whole content box, so whatever is drawn next has to start on
    // a fresh page rather than landing on top of it.
    if (added) canvas.markFilled();
    return added;
  } catch {
    // Unreadable or encrypted bytes: the caller falls back to printing the caption.
    return 0;
  }
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
 * Renders the caption that names an attachment.
 *
 * Set at the caption size on its own baseline grid, and held to a page: a caption split across a
 * page break identifies nothing, since the document it names would be on the other side of it.
 */
function drawAttachmentCaption(canvas: Canvas, fonts: Fonts, caption: string): void {
  if (!caption) return;
  const lines = layoutRuns([{ text: caption, bold: true }], fonts, CAPTION_SIZE, MARGIN_X, MARGIN_X, MARGIN_X + CONTENT_WIDTH);
  if (!lines.length) return;
  canvas.reserve(lines.length * CAPTION_LEADING);
  const top = canvas.cursor;
  lines.forEach((line, index) => canvas.drawLine(line, top - CAPTION_SIZE - index * CAPTION_LEADING, CAPTION_SIZE, INK));
  canvas.space(lines.length * CAPTION_LEADING + CAPTION_GAP);
}

/**
 * Fits an attachment image into the shared attachment box.
 *
 * Every image is fitted to the same frame and centred, so a chart that happens to be small and one
 * that happens to be large reach the page at comparable sizes. The same document at two different
 * resolutions therefore reaches the paper at the same size, which is what makes two attachments
 * look like two sheets of one document rather than two documents printed by different people. The
 * scale is capped only above: a source larger than the frame is scaled down to fit it, because a
 * floor that overrode the fit printed images outside the very frame it was meant to protect.
 */
function attachmentBox(image: { width: number; height: number }): { width: number; height: number; x: number } {
  const fit = Math.min(CONTENT_WIDTH / image.width, ATTACHMENT_BOX_HEIGHT / image.height);
  const scale = Math.min(fit, ATTACHMENT_MAX_SCALE);
  const width = image.width * scale;
  const height = image.height * scale;
  return { width, height, x: MARGIN_X + (CONTENT_WIDTH - width) / 2 };
}

/**
 * Renders one attachment and reports whether its content made it onto the page.
 *
 * The caption is always printed — it identifies the attachment, and for a file that cannot be
 * reproduced it is the only representation of it. It travels with an image when the image is too
 * tall for the space left and has to move to a fresh page, so no page ends up as a picture with
 * nothing to identify it, and for a PDF it is printed on the page that carries the first of its
 * pages rather than left behind at the foot of the text.
 */
async function drawAttachment(
  canvas: Canvas,
  fonts: Fonts,
  attachment: PrintableAttachment,
  caption = attachment.title,
): Promise<boolean> {
  // A PDF is printed page for page. Merely naming it left the sheet with a caption and no reference
  // to read, which is the one thing an attached PDF is there for, so the pages are now embedded.
  // The caption is printed by `drawPdfAttachmentPages`, on the first of those pages.
  if ((attachment.mimeType ?? "").includes("pdf") || (attachment.base64 ?? "").startsWith("JVBER")) {
    if (await drawPdfAttachmentPages(canvas, attachment, caption || null)) return true;
    // The bytes could not be parsed, so the caption is the whole representation of them.
    drawAttachmentCaption(canvas, fonts, caption);
    return false;
  }

  const image = await embedAttachmentImage(canvas, attachment);
  if (!image) {
    drawAttachmentCaption(canvas, fonts, caption);
    return false;
  }

  const box = attachmentBox(image);
  const captionHeight = caption ? CAPTION_LEADING + CAPTION_GAP : 0;
  // An image that does not fit in the space left moves to a fresh page rather than being squeezed
  // into it. Squeezing was the reason two sheets that were both fitted to the same box reached the
  // page at different sizes, which is the inconsistency this frame exists to remove: an image is
  // now either printed at the size the box gives it, or on a page of its own.
  if (box.height + captionHeight > canvas.remaining) {
    canvas.breakToNewPage();
    if (caption) drawAttachmentCaption(canvas, fonts, caption);
    image.draw(box.x, canvas.cursor - box.height, box.width, box.height);
    canvas.space(box.height);
    return true;
  }

  if (caption) drawAttachmentCaption(canvas, fonts, caption);
  image.draw(box.x, canvas.cursor - box.height, box.width, box.height);
  canvas.space(box.height);
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
    italic: await document.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await document.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const canvas = new Canvas(document, fonts);

  await drawLogo(canvas);
  drawCoverBlock(canvas, exam, fonts);

  if (exam.intro) {
    // At the body size with a little more leading than the body: the cover paragraph is prose, and
    // setting it a point larger made it read as a different kind of text rather than as a lead-in.
    drawFragment(canvas, fonts, exam.intro, BODY_SIZE, BODY_LEADING + 1, BODY_LEADING * 0.6);
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
    canvas.space(BODY_LEADING * 0.6);
    drawHeading(canvas, `Section ${section.sectionNumber} · ${section.title}`, fonts);
    // The heading is held to the first thing under it, then given room to breathe before the text
    // that follows, so a section opens as a block instead of as a heading buried in a paragraph.
    canvas.space(H1_LEADING * 0.3);
    // Set at the meta size rather than as a scaled offset from whatever the body size happened to be:
    // a per-section duration is meta, and it belongs on the same measure as the cover's, not one or
    // two points above or below it depending on which fragment it was drawn with.
    drawFragment(canvas, fonts, `Time allowed: ${formatDuration(section.durationSeconds)}`, META_SIZE, BODY_LEADING, BODY_LEADING * 0.5);
    drawFragment(canvas, fonts, section.introduction);
    // The instruction sheet is read with the instructions, so it prints before the extra notes
    // and the task itself rather than being held back with the other attachments.
    for (const title of section.introAttachmentTitles ?? []) {
      canvas.space(BODY_LEADING * 0.3);
      drawFragment(canvas, fonts, title, META_SIZE, BODY_LEADING, 0);
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
      drawFragment(canvas, fonts, title, META_SIZE, BODY_LEADING, 0);
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
