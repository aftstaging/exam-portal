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
  const lines = repairLigatures(text ?? "").split("\n");
  const nodes: React.ReactNode[] = [];
  let index = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
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