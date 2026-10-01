import { Fragment, type ReactNode } from "react";
import { parseRichHtml, type RichBlock, type RichRun } from "@shared/richText";

/**
 * Renders author-supplied exam content: paragraphs, headings, lists and tables.
 *
 * This component used to split the field into lines and interpret each one, which put raw
 * `<table>` markup on the learner's screen whenever a table shared a line with a sentence: the
 * line splitter had no notion of a table, so the markup fell through and was shown as text. The
 * renderer is now driven by the block model in `shared/richText`, which is the same model the
 * printable PDF writer draws, so a table is a table on screen and on paper by construction
 * rather than by two parsers agreeing to try.
 */

const EMAIL_HEADER = /^(from|to|cc|bcc|subject|date|re|attachments?|regards):\s*(.*)$/i;

/**
 * Rejoins words broken by a PDF's ligature substitution.
 *
 * A text layer built from a word processor's glyphs sometimes arrives as "speciﬁc" or "ﬁle",
 * and splitting a ligature out of a word turns it into two words in the reader's search.
 */
function repairLigatures(value: string): string {
  return value.replace(/([a-z]) (fi|ffi|ff|ffl|fl) ([a-z])/g, "$1$2$3");
}

/** Renders one emphasis run, splitting it where a hard line break was authored. */
function renderRun(run: RichRun, key: number): ReactNode {
  const text = run.text;
  const decorate = (child: ReactNode, index: number): ReactNode => {
    if (run.bold) child = <strong>{child}</strong>;
    if (run.italic) child = <em>{child}</em>;
    if (run.underline) child = <u>{child}</u>;
    if (run.strike) child = <s>{child}</s>;
    return <Fragment key={`${key}-${index}`}>{child}</Fragment>;
  };
  const lines = text.split("\n");
  if (lines.length === 1) return decorate(lines[0], 0);
  return (
    <Fragment key={key}>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          {decorate(line, index)}
        </Fragment>
      ))}
    </Fragment>
  );
}

function renderRuns(runs: RichRun[]): ReactNode {
  return <>{runs.map((run, index) => renderRun(run, index))}</>;
}

/** A table cell holds its own blocks, so a cell can carry a list or several paragraphs. */
function renderCell(blocks: RichBlock[], key: number, header: boolean): ReactNode {
  const Tag = header ? "th" : "td";
  return (
    <Tag
      key={key}
      {...(header ? { scope: "col" as const } : {})}
      className="border border-white/15 px-3 py-2 align-top"
    >
      {blocks.length ? renderBlocks(blocks) : null}
    </Tag>
  );
}

/**
 * Draws a table.
 *
 * Every row is padded to the width of the widest one. A short row would otherwise leave its
 * later columns to slide left underneath the columns above it, which reads as a different table
 * on each row.
 */
function renderTable(block: RichBlock, key: number): ReactNode {
  const table = block.table!;
  const columns = Math.max(1, ...table.rows.map((row) => row.length));
  return (
    <div key={key} className="my-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {table.rows.map((row, rowIndex) => {
            const header = table.headerRow && rowIndex === 0;
            return (
              <tr key={rowIndex}>
                {Array.from({ length: columns }, (_, column) =>
                  renderCell(row[column] ?? [], rowIndex * columns + column, Boolean(header)),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Groups consecutive list items so a run of bullets is one `<ul>` and a run of numbers one `<ol>`. */
function renderList(blocks: RichBlock[], start: number): [ReactNode, number] {
  const ordered = blocks[start]!.ordered;
  const items: ReactNode[] = [];
  let index = start;
  while (index < blocks.length) {
    const block = blocks[index]!;
    if (block.kind !== "listItem" || block.ordered !== ordered) break;
    // A nested list arrives as a deeper item; it is drawn inside its parent rather than beside
    // it, which is what keeps an indented sub-bullet under the bullet it belongs to.
    const depth = block.depth;
    const nested: RichBlock[] = [];
    index += 1;
    while (index < blocks.length && blocks[index]!.kind === "listItem" && blocks[index]!.depth > depth) {
      nested.push(blocks[index]!);
      index += 1;
    }
    items.push(
      <li key={`${start}-${index}`} className="ml-4 list-disc">
        {renderRuns(block.runs)}
        {nested.length ? renderBlocks(nested) : null}
      </li>,
    );
  }
  const Tag = ordered ? "ol" : "ul";
  return [
    <Tag key={start} className={`my-3 ml-5 space-y-1 pl-5 text-[#c4b5fd] ${ordered ? "list-decimal" : "list-disc"}`}>
      {items}
    </Tag>,
    index,
  ];
}

function renderBlock(block: RichBlock, key: number): ReactNode {
  const align = block.align ? { textAlign: block.align } : undefined;
  if (block.table) return renderTable(block, key);
  if (block.kind === "rule") return <hr key={key} className="my-4 border-white/15" />;
  if (block.kind === "heading") {
    const Tag = `h${Math.min(6, Math.max(1, block.level))}` as "h1";
    return (
      <Tag key={key} className="mt-5 text-base font-bold text-white" style={align}>
        {renderRuns(block.runs)}
      </Tag>
    );
  }
  return (
    <p key={key} className="mt-3 whitespace-pre-line leading-7" style={align}>
      {renderRuns(block.runs)}
    </p>
  );
}

function renderBlocks(blocks: RichBlock[]): ReactNode {
  const out: ReactNode[] = [];
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index]!;
    if (block.kind === "listItem") {
      const [node, next] = renderList(blocks, index);
      out.push(node);
      index = next;
      continue;
    }
    out.push(renderBlock(block, index));
    index += 1;
  }
  return <>{out}</>;
}

type EmailHeader = { rows: [string, string][]; body: string };

/**
 * Pulls an email's `From:`/`To:`/`Subject:` block off the front of a field.
 *
 * The fields that hold an email are plain text, not structured markup, so the header is
 * recognised from the text itself. It is separated here rather than in the parser because it is
 * a presentation of an email, not a meaning the text carries everywhere it is used.
 */
function splitEmailHeader(text: string): EmailHeader | null {
  const lines = text.split("\n");
  const rows: [string, string][] = [];
  let index = 0;
  while (index < lines.length) {
    const header = EMAIL_HEADER.exec(lines[index]!.trim());
    if (!header) break;
    rows.push([header[1]!, header[2]!]);
    index += 1;
  }
  if (!rows.length) return null;
  const body: string[] = [];
  while (index < lines.length && lines[index]!.trim() && !EMAIL_HEADER.test(lines[index]!.trim())) {
    body.push(lines[index]!);
    index += 1;
  }
  return { rows, body: body.join("\n") };
}

export function StructuredText({ text, className = "" }: { text?: string | null; className?: string }) {
  const source = repairLigatures(text ?? "");
  const email = splitEmailHeader(source);
  const blocks = parseRichHtml(email ? email.body : source);
  return (
    <div className={className}>
      {email && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#00e5ff]/25 bg-[#102b36]/40">
          <div className="border-b border-white/10 bg-[#18093c]/60 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[#00e5ff]">
            Email
          </div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-2">
            {email.rows.map(([label, value], index) => (
              <div key={index} className="bg-[#0c0524] px-4 py-2 text-sm text-[#c4b5fd]">
                <span className="mr-1.5 font-bold uppercase text-[#00e5ff]/70">{label}:</span>
                {value}
              </div>
            ))}
          </div>
        </div>
      )}
      {renderBlocks(blocks)}
    </div>
  );
}
