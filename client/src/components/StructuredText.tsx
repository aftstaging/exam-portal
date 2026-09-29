import { Fragment } from "react";

type Inline =
  | { kind: "text"; value: string }
  | { kind: "strong"; value: string }
  | { kind: "em"; value: string };

const EMAIL_HEADER = /^(from|to|cc|bcc|subject|date|re|attachments?|regards):\s*(.*)$/i;

function repairLigatures(value: string): string {
  return value.replace(/([a-z]) (fi|ffi|ff|ffl|fl) ([a-z])/g, "$1$2$3");
}

function inline(text: string): Inline[] {
  const result: Inline[] = [];
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  for (const token of tokens) {
    if (!token) continue;
    if (token.startsWith("**") && token.endsWith("**")) {
      result.push({ kind: "strong", value: token.slice(2, -2) });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      result.push({ kind: "em", value: token.slice(1, -1) });
    } else if (token.startsWith("##")) {
      result.push({ kind: "strong", value: token.replace(/^#+\s*/, "") });
    } else {
      result.push({ kind: "text", value: token });
    }
  }
  return result.filter((part) => part.value.length > 0);
}

function inlineContent(parts: Inline[], key: number): React.ReactNode {
  return (
    <Fragment key={key}>
      {parts.map((part, index) => {
        if (part.kind === "strong") return <strong key={index}>{inlineContent(inline(part.value), index)}</strong>;
        if (part.kind === "em") return <em key={index}>{inlineContent(inline(part.value), index)}</em>;
        return <Fragment key={index}>{part.value}</Fragment>;
      })}
    </Fragment>
  );
}

function isBullet(line: string): boolean {
  return /^[•●\-–]\s+/.test(line.trim());
}

function isNumbered(line: string): boolean {
  return /^\d{1,2}[.)]\s+/.test(line.trim());
}

function isHeading(line: string): boolean {
  return /^#{2,3}\s+/.test(line.trim());
}

/**
 * One authored table: its rows of cell text, and whether the first row is a `<th>` header row.
 * Cells hold plain text because the inline emphasis markers are re-parsed on render, so a cell
 * that contains `**bold**` is emphasised the same way prose around it is.
 */
type AuthoredTable = { rows: string[][]; headerRow: boolean };

const TABLE_OPEN = /<table\b[^>]*>([\s\S]*?)<\/table\s*>/i;
const TABLE_ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
const TABLE_CELL = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;

/**
 * Strips the inline tags a cell may contain, keeping the emphasis markers the rest of this
 * component already understands, so `**bold**` inside a cell renders the same as it does in prose.
 */
function cellText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(strong|b)\b[^>]*>/gi, "**")
    .replace(/<\/?(em|i)\b[^>]*>/gi, "*")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

/** Reads the first `<table>` in `text`, or null when there is none. */
function parseTable(text: string): AuthoredTable | null {
  const table = TABLE_OPEN.exec(text);
  if (!table) return null;
  const rows: string[][] = [];
  let headerRow = false;
  TABLE_ROW.lastIndex = 0;
  let row: RegExpExecArray | null;
  let rowIndex = 0;
  while ((row = TABLE_ROW.exec(table[1]!))) {
    const cells: string[] = [];
    let sawHeader = false;
    TABLE_CELL.lastIndex = 0;
    let cell: RegExpExecArray | null;
    while ((cell = TABLE_CELL.exec(row[1]!))) {
      if (cell[1]!.toLowerCase() === "th") sawHeader = true;
      cells.push(cellText(cell[2]!));
    }
    if (rowIndex === 0 && sawHeader) headerRow = true;
    // A row the pattern missed still needs to occupy a line rather than vanish.
    if (!cells.length) cells.push(cellText(row[1]!));
    rows.push(cells);
    rowIndex += 1;
  }
  return rows.length ? { rows, headerRow } : null;
}

function tableNode(table: AuthoredTable, key: number): React.ReactNode {
  // Every row is padded out to the widest one. A row with fewer cells would otherwise be rendered
  // short and its remaining columns would slide left under the columns above it.
  const columns = Math.max(...table.rows.map((row) => row.length));
  return (
    <div key={key} className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {table.rows.map((row, rowIndex) => {
            const header = table.headerRow && rowIndex === 0;
            return (
              <tr key={rowIndex} className="border-b border-white/10 last:border-b-0">
                {Array.from({ length: columns }, (_, column) => {
                  const content = <>{row[column] ? inlineContent(inline(row[column]!), rowIndex * columns + column) : null}</>;
                  return header ? (
                    <th key={column} scope="col" className="border-r border-white/10 bg-[#18093c] px-3 py-2 text-left align-top font-bold text-[#00e5ff] last:border-r-0">{content}</th>
                  ) : (
                    <td key={column} className="border-r border-white/10 px-3 py-2 align-top last:border-r-0">{content}</td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function headingInner(line: string): string {
  return line.replace(/^#{2,3}\s+/, "");
}

function bulletInner(line: string): string {
  return line.trim().replace(/^[•●\-–]\s+/, "");
}

function numberedInner(line: string): string {
  return line.trim().replace(/^\d{1,2}[.)]\s+/, "");
}

export function StructuredText({ text, className = "" }: { text?: string | null; className?: string }) {
  // A table is multi-line HTML, and splitting the text into lines first would tear the tags apart
  // and leave them visible as literal markup. It is lifted out whole and put back at the position
  // it was authored, the same way the printable PDF writer handles tables in author HTML.
  const tables: AuthoredTable[] = [];
  const withPlaceholders = (text ?? "").replace(/<table\b[^>]*>[\s\S]*?<\/table\s*>/gi, (markup) => {
    const table = parseTable(markup);
    if (!table) return markup;
    tables.push(table);
    return `\nAFT_TABLE_${tables.length - 1}\n`;
  });
  const lines = repairLigatures(withPlaceholders).split("\n");
  const nodes: React.ReactNode[] = [];
  let index = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }
    const placeholder = line.match(/^AFT_TABLE_(\d+)$/);
    if (placeholder) {
      const table = tables[Number(placeholder[1])];
      if (table) nodes.push(tableNode(table, index++));
      i += 1;
      continue;
    }
    const header = line.match(EMAIL_HEADER);
    if (header) {
      const headerRows: [string, string][] = [[header[1], header[2]]];
      i += 1;
      while (i < lines.length) {
        const next = lines[i].trim().match(EMAIL_HEADER);
        if (!next) break;
        headerRows.push([next[1], next[2]]);
        i += 1;
      }
      const body: string[] = [];
      while (i < lines.length && lines[i].trim() && !isBullet(lines[i]) && !isNumbered(lines[i]) && !isHeading(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      const flatBody = body.join("\n");
      nodes.push(
        <div key={index++} className="mt-4 overflow-hidden rounded-xl border border-[#00e5ff]/25 bg-[#102b36]/40">
          <div className="border-b border-white/10 bg-[#18093c]/60 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[#00e5ff]">Email</div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-2">
            {headerRows.map(([label, value], rowIndex) => (
              <div key={rowIndex} className="bg-[#0c0524] px-4 py-2 text-sm text-[#c4b5fd]">
                <span className="mr-1.5 font-bold uppercase text-[#00e5ff]/70">{label}:</span>
                {inlineContent(inline(value), rowIndex)}
              </div>
            ))}
          </div>
          {flatBody && <div className="whitespace-pre-line border-t border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-[#c4b5fd]">{flatBody}</div>}
        </div>
      );
      continue;
    }
    if (isHeading(line)) {
      nodes.push(
        <h3 key={index++} className="mt-5 text-base font-bold text-white">
          {inlineContent(inline(headingInner(line)), index)}
        </h3>
      );
      i += 1;
      continue;
    }
    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(bulletInner(lines[i]));
        i += 1;
      }
      nodes.push(
        <ul key={index++} className="mt-3 list-disc space-y-1 pl-5 text-[#c4b5fd]">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{inlineContent(inline(item), itemIndex)}</li>
          ))}
        </ul>
      );
      continue;
    }
    if (isNumbered(line)) {
      const items: string[] = [];
      while (i < lines.length && isNumbered(lines[i])) {
        items.push(numberedInner(lines[i]));
        i += 1;
      }
      nodes.push(
        <ol key={index++} className="mt-3 list-decimal space-y-1 pl-5 text-[#c4b5fd]">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{inlineContent(inline(item), itemIndex)}</li>
          ))}
        </ol>
      );
      continue;
    }
    const para: string[] = [lines[i]];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isBullet(lines[i]) &&
      !isNumbered(lines[i]) &&
      !isHeading(lines[i]) &&
      !EMAIL_HEADER.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i += 1;
    }
    nodes.push(
      <p key={index++} className="mt-3 whitespace-pre-line leading-7">
        {inlineContent(inline(para.join("\n")), index)}
      </p>
    );
  }
  return <div className={className}>{nodes}</div>;
}