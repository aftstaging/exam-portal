/**
 * Authored tables are stored as plain `<table>` markup inside an otherwise ordinary text field,
 * because the exam shell (`StructuredText`) and the printable PDF writer (`parseRichHtml`) both
 * already lay a table out from the element structure alone.
 *
 * That storage format is invisible to instructors, who author in a grid. The exam studio therefore
 * edits these tables through a visual grid and uses this module to convert between the two: the grid
 * is a list of rows of plain-text cells, and serialising turns it back into markup that both
 * renderers understand.
 *
 * Cell text keeps the same inline emphasis markers the prose fields use (`**bold**`, `*italic*`),
 * which are converted to `<strong>`/`<em>` on the way out and back again on the way in. Both
 * renderers understand the HTML form, so a cell is emphasised identically on screen and on paper.
 */

export type AuthoredTable = { rows: string[][]; headerRow: boolean };

export type AuthoredSegment =
  | { kind: "prose"; value: string }
  | { kind: "table"; markup: string };

const TABLE_OPEN = /<table\b[^>]*>([\s\S]*?)<\/table\s*>/i;
const TABLE_ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
const TABLE_CELL = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;

/**
 * Matches a single inline emphasis marker run, in the same precedence order `StructuredText` uses.
 *
 * Every emphasis the studio offers is listed here, not just bold and italic, because the round trip
 * has to be lossless in both directions: a marker this cannot read back would silently become plain
 * text the first time an author touched that cell in the grid.
 */
const INLINE_MARKERS = /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_\n]+__|~~[^~\n]+~~)/g;

/** The marker for each emphasis the cell grid can round-trip, longest delimiter first. */
const CELL_EMPHASIS: { marker: string; tag: string }[] = [
  { marker: "**", tag: "strong" },
  { marker: "*", tag: "em" },
  { marker: "__", tag: "u" },
  { marker: "~~", tag: "s" },
];

/**
 * Turns a cell's stored HTML into the plain text an author edits.
 *
 * Inline tags become the emphasis markers the rest of the authoring UI uses, so a cell that was
 * authored as `<strong>Total</strong>` reads as `**Total**` rather than losing its emphasis. Every
 * emphasis the studio can apply is converted, not only bold and italic: an underline the cell
 * cannot show would be flattened to plain text by the generic tag strip below and lost the moment
 * the author edited the cell. A line break becomes a space because a cell is edited on one line.
 */
export function authoredCellText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(strong|b)\b[^>]*>/gi, "**")
    .replace(/<\/?(em|i)\b[^>]*>/gi, "*")
    .replace(/<\/?u\b[^>]*>/gi, "__")
    .replace(/<\/?(s|strike|del)\b[^>]*>/gi, "~~")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

/**
 * Escapes authored cell text and turns its emphasis markers into tags.
 *
 * Escaping happens before the markers are wrapped, so text an author typed as `<b>` cannot inject
 * markup into the field.
 */
export function authoredCellHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .split(INLINE_MARKERS)
    .map((token) => {
      for (const { marker, tag } of CELL_EMPHASIS) {
        // A run needs a character between its delimiters to be emphasis rather than two stray ones.
        if (token.length <= marker.length * 2) continue;
        if (token.startsWith(marker) && token.endsWith(marker)) {
          return `<${tag}>${token.slice(marker.length, -marker.length)}</${tag}>`;
        }
      }
      return token;
    })
    .join("");
}

/** Reads a `<table>` element into the grid model, or null when there is no readable table. */
export function parseAuthoredTable(markup: string): AuthoredTable | null {
  const match = TABLE_OPEN.exec(markup);
  if (!match) return null;
  const rows: string[][] = [];
  let headerRow = false;
  TABLE_ROW.lastIndex = 0;
  let row: RegExpExecArray | null;
  let rowIndex = 0;
  while ((row = TABLE_ROW.exec(match[1]!))) {
    const cells: string[] = [];
    let sawHeader = false;
    TABLE_CELL.lastIndex = 0;
    let cell: RegExpExecArray | null;
    while ((cell = TABLE_CELL.exec(row[1]!))) {
      if (cell[1]!.toLowerCase() === "th") sawHeader = true;
      cells.push(authoredCellText(cell[2]!));
    }
    // A row the pattern missed still needs to occupy a line rather than vanish.
    if (!cells.length) cells.push(authoredCellText(row[1]!));
    rows.push(cells);
    if (rowIndex === 0 && sawHeader) headerRow = true;
    rowIndex += 1;
  }
  return rows.length ? { rows, headerRow } : null;
}

/**
 * Writes the grid model back out as a `<table>`.
 *
 * Every row is padded to the width of the widest one, so the rendered table is a clean rectangle
 * rather than a ragged edge. The markup carries no styling attributes: the exam shell and the PDF
 * writer both derive the borders and the header emphasis from the element structure.
 */
export function serializeAuthoredTable(table: AuthoredTable): string {
  const width = Math.max(1, ...table.rows.map((row) => row.length));
  const source = table.rows.length ? table.rows : [Array<string>(width).fill("")];
  const rows = source.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
  const [head, ...body] = rows;
  const cell = (value: string, tag: "th" | "td") => `<${tag}>${authoredCellHtml(value)}</${tag}>`;

  const lines = ["<table>"];
  if (table.headerRow) {
    lines.push("<thead>", `<tr>${head.map((value) => cell(value, "th")).join("")}</tr>`, "</thead>");
  }
  lines.push("<tbody>");
  for (const row of table.headerRow ? body : rows) {
    lines.push(`<tr>${row.map((value) => cell(value, "td")).join("")}</tr>`);
  }
  lines.push("</tbody>", "</table>");
  return lines.join("\n");
}

/**
 * Splits a field into its prose and table parts, in authored order, so the studio can show a grid
 * exactly where the table sits in the surrounding text.
 *
 * The prose chunks are kept verbatim, including their blank lines, so joining the parts back
 * together reproduces the field byte for byte.
 */
export function splitAuthoredContent(value: string): AuthoredSegment[] {
  const segments: AuthoredSegment[] = [];
  let cursor = 0;
  const table = new RegExp(TABLE_OPEN.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = table.exec(value))) {
    if (match.index > cursor) segments.push({ kind: "prose", value: value.slice(cursor, match.index) });
    segments.push({ kind: "table", markup: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) segments.push({ kind: "prose", value: value.slice(cursor) });
  return segments;
}

/** Rebuilds a field from its parts, the inverse of `splitAuthoredContent`. */
export function joinAuthoredContent(segments: AuthoredSegment[]): string {
  return segments
    .map((segment) => (segment.kind === "prose" ? segment.value : segment.markup))
    .join("");
}
