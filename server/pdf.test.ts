import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, StandardFonts, decodePDFRawStream } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { generateBrandedPrintablePdf, inlinePrintablePayload, parseRichHtml } from "./pdf";

/**
 * Pulls the drawn text back out of a generated PDF.
 *
 * The page-level assertions above only prove a PDF was produced; the layout bugs this file
 * guards against (words run together, dropped table columns) are only visible in the extracted
 * text, so those tests read it back the way a reader's PDF viewer would.
 */
async function extractText(bytes: Uint8Array): Promise<string> {
  // pdfjs rejects a Node Buffer, so the generator's output is copied into a plain Uint8Array.
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const parts: string[] = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ("str" in item && item.str) parts.push(item.str);
    }
  }
  return parts.join(" ");
}

/** Reads back the drawn text with the position, size and drawn width of each item, for layout assertions. */
async function extractTextItems(bytes: Uint8Array): Promise<{ text: string; x: number; y: number; width: number; size: number; page: number }[]> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const items: { text: string; x: number; y: number; width: number; size: number; page: number }[] = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const content = await (await doc.getPage(number)).getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      const transform = (item as { transform: number[] }).transform;
      items.push({
        text: item.str,
        x: transform[4] as number,
        y: transform[5] as number,
        width: (item as { width?: number }).width ?? 0,
        size: transform[0] as number,
        page: number,
      });
    }
  }
  return items;
}

/**
 * Reports every pair of runs printed through one another.
 *
 * Two runs on the same baseline whose horizontal extents intersect are sharing the same strip of
 * page: the effect the sheet showed wherever a header drew its labels and values onto one line.
 * Grouped by page as well as baseline, since two pages reuse the same baseline positions.
 */
function crossings(items: { text: string; x: number; y: number; width: number; page: number }[]): string[] {
  const lines = new Map<string, typeof items>();
  for (const item of items) {
    const key = `${item.page}|${Math.round(item.y)}`;
    lines.set(key, [...(lines.get(key) ?? []), item]);
  }
  const found: string[] = [];
  for (const [key, runs] of lines) {
    const row = [...runs].sort((a, b) => a.x - b.x);
    for (let index = 1; index < row.length; index += 1) {
      const previous = row[index - 1]!;
      const current = row[index]!;
      // A small negative gap is the difference between the width this test measures and the one
      // the writer laid out against; anything past it is the two runs genuinely sharing page.
      if (current.x - (previous.x + previous.width) < -0.5) found.push(`p${key} "${previous.text}" | "${current.text}"`);
    }
  }
  return found;
}

/** The size each run was drawn at, read back from the text matrix pdfjs reports. */
async function drawnSizes(bytes: Uint8Array): Promise<number[]> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const sizes = new Set<number>();
  for (let number = 1; number <= doc.numPages; number += 1) {
    for (const item of (await (await doc.getPage(number)).getTextContent()).items) {
      if (!("str" in item) || !item.str) continue;
      sizes.add(Math.round(((item.transform as number[])[0] as number) * 100) / 100);
    }
  }
  return [...sizes].sort((a, b) => b - a);
}

/**
 * The width and height each image was drawn at, read from the matrix its `Do` is placed under.
 *
 * pdf-lib writes an image as a `cm` scale followed by the `Do`, so the product of the matrices
 * above each `Do` is the size the picture reached the page at — which is the thing that has to
 * look the same from one attachment to the next.
 */
async function drawnImageSizes(bytes: Uint8Array): Promise<{ width: number; height: number }[]> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const sizes: { width: number; height: number }[] = [];
  for (const page of document.getPages()) {
    for (const source of pageContentStreams(document, page.node.Contents())) {
      const text = Buffer.from(decodePDFRawStream(source).decode()).toString("latin1");
      for (const draw of text.matchAll(/\/Image[\w.-]*\s+(?:[\d.]+ 0 R\s+)?Do/g)) {
        const block = text.lastIndexOf("\nq\n", draw.index);
        let width = 1;
        let height = 1;
        for (const matrix of text.slice(block === -1 ? 0 : block, draw.index).matchAll(/([\d.]+) 0 0 ([\d.]+) [\d.-]+ [\d.-]+ cm/g)) {
          width *= Number(matrix[1]);
          height *= Number(matrix[2]);
        }
        sizes.push({ width: Math.round(width * 10) / 10, height: Math.round(height * 10) / 10 });
      }
    }
  }
  return sizes;
}

/**
 * Walks the page's content stream and reports every text run with the face it was drawn in.
 *
 * This reads the file's own drawing operators rather than asking a renderer, because neither the
 * resource name pdfjs reports (`g_d0_f1`) nor the width it measures identifies the face: the two
 * standard faces are close enough in width that a measurement decides wrongly, and a table header
 * or an email block set in the wrong face is exactly what these assertions exist to catch.
 * pdf-lib registers one font resource per embed, named after its base font, so the face follows
 * from the resource the `Tf` operator selected.
 */
async function drawnRuns(bytes: Uint8Array): Promise<{ font: string; text: string }[]> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const runs: { font: string; text: string }[] = [];
  for (const page of document.getPages()) {
    const fontResources = new Map<string, string>();
    const fonts = page.node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
    if (fonts) {
      for (const [key, value] of fonts.entries()) {
        const font = document.context.lookup(value);
        if (font instanceof PDFDict) {
          const base = font.get(PDFName.of("BaseFont"));
          if (base instanceof PDFName) fontResources.set(key.asString().slice(1), base.asString().slice(1));
        }
      }
    }
    for (const source of pageContentStreams(document, page.node.Contents())) {
      const text = Buffer.from(decodePDFRawStream(source).decode()).toString("latin1");
      let font = "";
      // pdf-lib writes one `Tf` per run followed by a single `Tj`, so the face in force when a
      // string is shown is the face that run was drawn with. Strings are hex-encoded, which is
      // why they are decoded from the byte pairs rather than read as literal text.
      for (const token of text.matchAll(/\/([A-Za-z0-9#+.-]+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]*)>\s*Tj/g)) {
        if (token[1] !== undefined) {
          font = fontResources.get(token[1]) ?? token[1];
          continue;
        }
        const bytes = token[2] ?? "";
        let shown = "";
        for (let index = 0; index + 1 < bytes.length; index += 2) shown += String.fromCharCode(Number.parseInt(bytes.slice(index, index + 2), 16));
        runs.push({ font, text: shown });
      }
    }
  }
  return runs;
}

/** The runs drawn in the bold face, and those in the regular one. */
function facesOf(runs: { font: string; text: string }[]): { bold: string[]; regular: string[] } {
  const bold: string[] = [];
  const regular: string[] = [];
  for (const run of runs) {
    if (!run.text.trim()) continue;
    if (/bold/i.test(run.font)) bold.push(run.text);
    else regular.push(run.text);
  }
  return { bold, regular };
}

const CRC_TABLE = (() => {
  const table: number[] = [];
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table.push(crc >>> 0);
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, checksum]);
}

/**
 * Builds a valid truecolour PNG so the embed path can be exercised with real image bytes.
 *
 * Generated rather than committed as a fixture so the test carries no binary blob.
 */
function buildPng(width: number, height: number): string {
  const scanlines = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 3 + 1);
    scanlines[start] = 0;
    for (let x = 0; x < width; x += 1) {
      const at = start + 1 + x * 3;
      const edge = x < 2 || y < 2 || x >= width - 2 || y >= height - 2;
      scanlines[at] = edge ? 20 : 235;
      scanlines[at + 1] = edge ? 40 : 235;
      scanlines[at + 2] = edge ? 90 : 235;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

/**
 * Measures the on-page width of every image drawn in a PDF.
 *
 * pdf-lib writes each placement as a `cm` matrix before the image's `Do` operator, so the
 * horizontal scale in that matrix is the drawn width. Measuring the placement (rather than
 * checking for an `/Image` object) is what distinguishes a readable embed from a sliver, since
 * the branded logo is an image too.
 */
async function drawnImageWidths(bytes: Uint8Array): Promise<number[]> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const widths: number[] = [];
  for (const page of document.getPages()) {
    for (const source of pageContentStreams(document, page.node.Contents())) {
      const text = Buffer.from(decodePDFRawStream(source).decode()).toString("latin1");
      // A placement is a `q ... cm ... /Image-x Do ... Q` block. pdf-lib writes the scale as one
      // matrix and pads the block with identity `1 0 0 1 0 0 cm` steps, so the drawn width is the
      // product of the horizontal factors in that block rather than any single matrix.
      for (const doMatch of text.matchAll(/\/Image[\w.-]*\s+(?:[\d.]+ 0 R\s+)?Do/g)) {
        const blockStart = text.lastIndexOf("\nq\n", doMatch.index);
        const before = text.slice(blockStart === -1 ? 0 : blockStart, doMatch.index);
        let width = 1;
        for (const matrix of before.matchAll(/([\d.]+) 0 0 [\d.]+ [\d.-]+ [\d.-]+ cm/g)) {
          width *= Number(matrix[1]);
        }
        widths.push(width);
      }
    }
  }
  return widths;
}

/** Resolves a page's `/Contents` entry, which may be one stream or an array of them. */
function pageContentStreams(document: PDFDocument, contents: unknown): PDFRawStream[] {
  const resolved = document.context.lookup(contents as never);
  if (resolved instanceof PDFRawStream) return [resolved];
  if (resolved instanceof PDFArray) {
    return resolved
      .asArray()
      .map((entry) => document.context.lookup(entry))
      .filter((entry): entry is PDFRawStream => entry instanceof PDFRawStream);
  }
  return [];
}

/**
 * Every horizontal rule drawn on every page, read back from the file's own operators.
 *
 * A rule is a filled path of negligible height, so it is recognised by its shape rather than by an
 * operator, and the matrix placing it is matched on its tail because pdf-lib wraps it across a
 * newline. The identity translates that follow the real one are set aside: taking the last
 * translation before the path instead of the only positioned one reports every rule at the origin.
 */
async function drawnRules(bytes: Uint8Array): Promise<{ x: number; y: number; width: number; page: number }[]> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const rules: { x: number; y: number; width: number; page: number }[] = [];
  document.getPages().forEach((page, index) => {
    for (const stream of pageContentStreams(document, page.node.Contents())) {
      const content = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      const placed = [...content.matchAll(/0 1 ([\d.-]+) ([\d.-]+) cm/g)]
        .map((match) => ({ x: Number(match[1]), y: Number(match[2]), at: match.index! }))
        .filter((translation) => !(translation.x === 0 && translation.y === 0));
      for (const path of content.matchAll(/0 0 m\r?\n0 ([\d.]+) l\r?\n([\d.]+) \1 l\r?\n\2 0 l/g)) {
        // A path of any real height is a table cell or a shaded block, not a rule under a line.
        if (Number(path[1]) > 1) continue;
        const translation = placed.filter((entry) => entry.at < path.index).pop();
        if (translation) rules.push({ x: translation.x, y: translation.y, width: Number(path[2]), page: index + 1 });
      }
    }
  });
  return rules;
}

describe("branded printable exam PDF", () => {
  it("creates a readable PDF with exam and section content", async () => {
    const bytes = await generateBrandedPrintablePdf({ title: "Cartn Mock Exam 4", intro: "Imported case-study mock", totalDurationSeconds: 10800 }, [{ sectionNumber: 1, title: "Digital data sources", durationSeconds: 2700, introduction: "Assess the decision context." }]);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(0);
    expect(bytes.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("recognizes supported image and PDF attachment payloads", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const pdfBase64 = Buffer.from(await source.save()).toString("base64");
    const pngBase64 = buildPng(2, 2);

    expect(inlinePrintablePayload(`data:application/pdf;base64,${pdfBase64}`)).toEqual({ base64: pdfBase64, mimeType: "application/pdf" });
    expect(inlinePrintablePayload(pngBase64)).toEqual({ base64: pngBase64, mimeType: "image/png" });
    expect(inlinePrintablePayload("data:application/octet-stream;base64,SGVsbG8=")).toBeNull();
  });

  it("interprets the full exam document including intro, emails, and attachments", async () => {
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: "Imported case-study mock designed for the Management Case Study.", totalDurationSeconds: 10800 },
      [
        { sectionNumber: 1, title: "Digital data sources", durationSeconds: 2700, introduction: "Assess the decision context.", scenario: "SoPa Foods is considering a takeaway and home-delivery service.", question: "Recommend how management should evaluate the control environment." },
        { sectionNumber: 2, title: "Delivery economics", durationSeconds: 2700, introduction: "Evaluate the mobile hurdle.", scenario: "Route density determines delivery economics.", question: "Compute the contribution per delivery route." },
      ],
      {
        email: { from: "board@sopa.co.za", to: "candidate@aft-portal.exam", subject: "Board update", html: "<p>Please review the attached delivery schedule.</p><p>The finance team has been asked to evaluate contribution margins.</p>" },
        attachments: [
          { kind: "pre_seen", title: "Cartn Mock Exam 4 · Pre-seen" },
          { kind: "formulae", title: "Cartn Mock Exam 4 · Formulae + tables" },
          { kind: "reference", title: "Cartn Mock Exam 4 · Reference material" },
          { kind: "email", title: "Cartn Mock Exam 4 · Email" },
        ],
      },
    );
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(0);
    expect(document.getPage(0).getSize().width).toBe(595);
    // The question is the one line the sheet exists to carry. A patch merge dropped its draw
    // while db.ts kept sending it and this test kept passing, because it only looked at page
    // geometry — so the sheet's own text is checked here, question included.
    const text = await extractText(bytes);
    expect(text).toContain("Recommend how management should evaluate the control environment.");
    expect(text).toContain("Compute the contribution per delivery route.");
    expect(text).toContain("SoPa Foods is considering a takeaway and home-delivery service.");
  });

  it("renders content containing characters outside the WinAnsi encoding", async () => {
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: "● Assess the control environment → review the residual risk", totalDurationSeconds: 10800 },
      [{ sectionNumber: 1, title: "Digital data sources ●", durationSeconds: 2700, introduction: "● Identify the material misstatement\n● Evaluate the deficiency ≤ R10 000\n● Contribution margin ≥ 40% × 100 ÷ 4", scenario: "─ SoPa Foods ─ ☰ summary █ 42 000", question: "☐ Yes ☐ No ✓ ✔ ✗ ✕ → ← ↔ ≠ ≈ ∑ π √ ∞ ½ ¼ № ⅓ ½" }],
    );
    const document = await PDFDocument.load(bytes);
    expect(bytes.slice(0, 5).toString()).toBe("%PDF-");
    expect(document.getPageCount()).toBeGreaterThan(0);
  });

  it("never throws for any Unicode code point", async () => {
    let all = "";
    for (let codePoint = 0; codePoint <= 0xffff; codePoint++) {
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue;
      all += String.fromCodePoint(codePoint);
    }
    all += "\u{1F600}\u{1F4A9}\u{20000}";
    const bytes = await generateBrandedPrintablePdf({ title: all, intro: all, totalDurationSeconds: 3600 }, [{ sectionNumber: 1, title: all, durationSeconds: 600, introduction: all, scenario: all, question: all, email: { subject: all, html: `<p>${all}</p>` }, attachmentTitles: [all] }], { attachments: [{ kind: "pre_seen", title: all }] });
    expect(bytes.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("keeps words separated by spaces when wrapping a line", async () => {
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: "Answer all tasks. <strong>Show your workings</strong> in the answer pad provided.", totalDurationSeconds: 10800 },
      [{ sectionNumber: 1, title: "Digital data sources", durationSeconds: 2700, introduction: "Assess the decision context for the new delivery service." }],
    );
    const text = await extractText(bytes);
    // A separator read from the wrong token drops the last space of a run and welds words together.
    expect(text).toContain("Answer all tasks.");
    expect(text).toContain("in the answer pad provided.");
    expect(text).toContain("Digital data sources");
    expect(text).toContain("45 minutes");
    expect(text).not.toMatch(/\b\w+(?:ing|ed|tion|ments)\b(?=provided|sources|context)/);
  });

  it("draws every column of a table row", async () => {
    const html = "<p>Route data:</p><table><thead><tr><th>Region</th><th>Deliveries</th><th>Contribution</th></tr></thead><tbody><tr><td>Region 1</td><td>1250</td><td>225.00</td></tr></tbody></table>";
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [{ sectionNumber: 1, title: "Delivery economics", durationSeconds: 2700, email: { subject: "Route density", html } }],
    );
    const text = await extractText(bytes);
    // Columns were flattened into one line list, so only the first cell of each row survived.
    expect(text).toContain("Deliveries");
    expect(text).toContain("Contribution");
    expect(text).toContain("1250");
    expect(text).toContain("225.00");
  });

  it("draws a list marker clear of the text it introduces", async () => {
    const html = "<ul><li><strong>(sub-task (a) = 52%)</strong> Explain the budgeted results.</li></ul>";
    const bytes = await generateBrandedPrintablePdf(
      { title: "CIMA OCS Mock Exam 1", intro: null, totalDurationSeconds: 2700 },
      [{ sectionNumber: 1, title: "Task 1", durationSeconds: 2700, email: { subject: "Management accounts", html } }],
    );
    const text = await extractText(bytes);
    expect(text).toContain("Explain the budgeted results.");
    // A marker drawn at the line's own x would print on top of the first word, so the two are
    // compared by position on the shared baseline rather than by the order of the text items.
    const items = await extractTextItems(bytes);
    const bullet = items.find((item) => item.text === "\u2022");
    const lead = items.find((item) => item.text.includes("sub-task"));
    expect(bullet).toBeDefined();
    expect(lead).toBeDefined();
    expect(bullet!.y).toBeCloseTo(lead!.y, 0);
    expect(bullet!.x).toBeLessThan(lead!.x);
  });

  it("keeps every line inside the printable width", async () => {
    // Both defects this guards against pushed text past the right margin: a line laid out in the
    // regular face but painted bold, and the same for a bold table header row.
    const html =
      "<p>Please answer all of the following questions in the answer pad provided and show all of your workings clearly, including every assumption that you have made.</p>" +
      "<table><thead><tr><th>Region</th><th>Deliveries</th><th>Contribution</th></tr></thead><tbody><tr><td>Region 1</td><td>1250</td><td>225.00</td></tr></tbody></table>";
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: "Answer all tasks in the answer pad provided.", totalDurationSeconds: 10800 },
      [{ sectionNumber: 1, title: "Digital data sources", durationSeconds: 2700, email: { from: "fd@sofa.co.za", subject: "Management accounts", html } }],
    );
    // `width` is the width pdfjs measured on the page, so this catches a run that was laid out in
    // one face and painted in another just as a genuinely too-wide line would be caught.
    const items = await extractTextItems(bytes);
    const limit = 595 - 56.7;
    const overflow = items.filter((item) => item.x + item.width > limit + 0.5);
    expect(overflow.map((item) => item.text)).toEqual([]);
  });

  it("keeps the first two words of a wrapped line apart", async () => {
    // The break consumed the gap that belonged to the *next* token, so the first word of every
    // continuation line was welded to the second ("circulated" + "by" -> "circulatedby").
    const filler =
      "Please answer all of the following questions in the answer pad provided and show all of your workings clearly, including the assumptions that you have made in respect of the delivery schedule that was circulated by the operations team last week.";
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: filler, totalDurationSeconds: 10800 },
      [{ sectionNumber: 1, title: "Delivery economics", durationSeconds: 2700, introduction: filler }],
    );
    const text = await extractText(bytes);
    // The text is long enough to wrap, and a welded word reads as one token, so the phrase is
    // only findable when the gap survived the break.
    expect(text.length).toBeGreaterThan(0);
    const lines = (await extractTextItems(bytes)).filter((item) => item.x < 60 && item.y > 300);
    expect(lines.length).toBeGreaterThan(1);
    expect(text).not.toMatch(/circulatedby|\bclearlyincluding\b/);
  });

  it("sets the email body in the regular face, keeping only the header labels bold", async () => {
    const bytes = await generateBrandedPrintablePdf(
      { title: "CIMA OCS Mock Exam 1", intro: null, totalDurationSeconds: 2700 },
      [{ sectionNumber: 1, title: "Task 1", durationSeconds: 2700, email: { from: "fd@sofa.co.za", to: "smt@sofa.co.za", subject: "Management accounts", html: "<p>Please include the budgeted results in your answer.</p>" } }],
    );
    const { bold, regular } = facesOf(await drawnRuns(bytes));
    const find = (runs: string[], needle: string) => runs.find((text) => text.includes(needle));
    // A whole email block set bold flattened every distinction in it; only the labels stay bold.
    expect(find(bold, "From")).toBeDefined();
    expect(find(bold, "Subject")).toBeDefined();
    expect(find(regular, "fd@sofa.co.za")).toBeDefined();
    expect(find(regular, "budgeted results")).toBeDefined();
    expect(find(bold, "budgeted results")).toBeUndefined();
  });

  it("stacks the email header rows instead of printing them through one another", async () => {
    const bytes = await generateBrandedPrintablePdf(
      { title: "CIMA OCS Mock Exam 1", intro: null, totalDurationSeconds: 2700 },
      [{ sectionNumber: 1, title: "Task 1", durationSeconds: 2700, email: { from: "fd@sofa.co.za", to: "smt@sofa.co.za", subject: "Management accounts", html: "<p>Please include the budgeted results in your answer.</p>" } }],
    );
    const items = await extractTextItems(bytes);
    const baselineOf = (text: string) => items.find((item) => item.text.trim() === text)?.y;
    // The three rows were reserved but never advanced the cursor, so the labels and all three
    // values landed on one baseline and printed through each other: the header was unreadable.
    const rows = [baselineOf("From"), baselineOf("To"), baselineOf("Subject")];
    expect(rows.every((row) => row !== undefined)).toBe(true);
    expect(new Set(rows).size).toBe(3);
    // Nothing on the page may share a baseline while overlapping horizontally.
    expect(crossings(items)).toEqual([]);
  });

  it("prints no pair of words through one another across a whole sheet", async () => {
    // Every band of the sheet at once, because the overlap was never confined to one block: the
    // email header, the authored lists, the table columns and the attachment captions all drew
    // against a position that another run was already using.
    const html =
      "<p>Please answer all of the following questions in the answer pad provided and show all of your workings clearly.</p>" +
      "<ul><li><strong>(sub-task (a) = 52%)</strong> Explain the budgeted results.</li><li>Explain the benefits of marginal costing.</li></ul>" +
      "<table><thead><tr><th>Region</th><th>Deliveries</th><th>Contribution</th></tr></thead><tbody><tr><td>Region 1</td><td>1250</td><td>225.00</td></tr></tbody></table>";
    const bytes = await generateBrandedPrintablePdf(
      { title: "CIMA OCS Mock Exam 1", intro: "Answer all four tasks in the time allowed.", totalDurationSeconds: 10800, examType: "case_study" },
      [{ sectionNumber: 1, title: "Task 1", durationSeconds: 2700, introduction: html, email: { from: "fd@sopa.co.za", to: "candidate@aft-portal.exam", subject: "Management accounts — revised", html } }],
    );
    const items = await extractTextItems(bytes);
    expect(items.length).toBeGreaterThan(30);
    expect(crossings(items)).toEqual([]);
  });

  it("prints two attachments of the same shape at the same size", async () => {
    // The same chart at two resolutions is the clearest case of the defect: attachments used to be
    // drawn at whatever size fitted the space left on the page, so the smaller file reached the
    // paper scaled to the leftovers beside a bigger one.
    const bytes = await generateBrandedPrintablePdf(
      { title: "CIMA OCS Mock Exam 1", intro: null, totalDurationSeconds: 2700 },
      [{
        sectionNumber: 1,
        title: "Task 1",
        durationSeconds: 2700,
        attachmentTitles: ["Reference material: large chart", "Reference material: small chart"],
        attachments: [
          { kind: "reference", title: "Reference material: large chart", base64: buildPng(1200, 900), mimeType: "image/png" },
          { kind: "reference", title: "Reference material: small chart", base64: buildPng(400, 300), mimeType: "image/png" },
        ],
      }],
    );
    const images = await drawnImageSizes(bytes);
    // The logo heads the cover at 56pt and repeats at 16pt in every page's foot; neither is an
    // attachment, so both are set aside by height.
    const attachments = images.filter((image) => image.height !== 56 && image.height !== 16);
    // One attachment per sheet, so neither is scaled by the room the other happened to leave.
    expect(attachments).toHaveLength(2);
    expect(attachments[1]).toEqual(attachments[0]);
    // Both sit inside the shared frame rather than filling the measure or running past it.
    expect(attachments[0]!.width).toBeLessThanOrEqual(595 - 56.7 * 2);
    expect(attachments[0]!.height).toBeLessThanOrEqual(300);
  });

  it("sets every run on the sheet from one declared step of the type scale", async () => {
    const bytes = await generateBrandedPrintablePdf(
      { title: "CIMA OCS Mock Exam 1", intro: "Answer all four tasks in the time allowed.", totalDurationSeconds: 10800, examType: "case_study" },
      [{ sectionNumber: 1, title: "Task 1", durationSeconds: 2700, introduction: "## Instructions\nAssess the decision context.\n● Identify the misstatement.", email: { from: "fd@sopa.co.za", subject: "Management accounts", html: "<p>Please include the budgeted results.</p>" }, attachments: [{ kind: "reference", title: "Reference material: chart", base64: buildPng(600, 400), mimeType: "image/png" }] }],
    );
    // Sizes used to be written as offsets at the call sites — `SMALL_SIZE + 1`, `BODY_SIZE + 1` —
    // which is how one sheet ended up carrying nine sizes and "Time allowed" at 15pt under the
    // title and 9pt inside a section. Every size on the page is now a declared step.
    expect(await drawnSizes(bytes)).toEqual([22, 13.5, 11.5, 10.5, 9.5, 9, 8]);
  });

  it("centres the type and the title of the title block, with clear air between them", async () => {
    // The type, the title and the duration were each drawn at the left margin, so the cover read
    // as three unrelated lines stacked on the left rather than as one block announcing the paper.
    const bytes = await generateBrandedPrintablePdf(
      { title: "CIMA OCS Mock Exam 1", intro: "Answer all four tasks.", totalDurationSeconds: 10800, examType: "case_study" },
      [],
    );
    const items = await extractTextItems(bytes);
    const line = (text: string) => items.find((item) => item.text.trim() === text);
    const type = line("CASE STUDY EXAM")!;
    const title = line("CIMA OCS Mock Exam 1")!;
    const duration = line("Time allowed: 3 hours")!;

    const MARGIN_X = 56.7;
    const middle = MARGIN_X + (595 - MARGIN_X * 2) / 2;
    // pdfjs measures a run's width to a fraction of a point, so the centring is asserted with the
    // slack that measurement itself carries rather than exactly.
    for (const run of [type, title, duration]) {
      expect(Math.abs(run.x + run.width / 2 - middle)).toBeLessThan(1);
    }
    // The type labels the paper and the title names it, so the title has to read as the subject:
    // a label tucked against the name it labels leaves the two as one undifferentiated line pair.
    expect(type.y - title.y).toBeGreaterThan(24);
    // And the duration sits under the title rather than beside it, so the block is a stack.
    expect(title.y - duration.y).toBeGreaterThan(0);
    // The brief shares the cover's page, so the stack is read top to bottom in one place rather
    // than being split across the front of the paper and page 2.
    expect(line("Answer all four tasks.")!.page).toBe(duration.page);
  });

  it("keeps the title block free of a rule, and holds no task on the front page", async () => {
    // `drawAt` paints a run without moving the cursor, so the gap measured after "Time allowed" was
    // counted from a position the text had already left, and a closing rule once came out inside
    // the line's x-height: the sheet opened with "Time allowed" struck through. The title block no
    // longer carries a closing rule at all — the brief shares the page now, so nothing separates
    // them but air — so the guard is that nothing ruled lands anywhere in the duration's band.
    const bytes = await generateBrandedPrintablePdf(
      { title: "CIMA OCS Mock Exam 1", intro: "Answer all four tasks.", totalDurationSeconds: 10800, examType: "case_study" },
      [],
    );
    const items = await extractTextItems(bytes);
    const line = (text: string) => items.find((item) => item.text.trim() === text);
    const duration = line("Time allowed: 3 hours")!;
    const rules = (await drawnRules(bytes)).filter((rule) => rule.page === duration.page);
    const striking = rules.filter((rule) => rule.y < duration.y + duration.size && rule.y > duration.y - duration.size * 0.25);
    expect(striking).toHaveLength(0);
    // The brief belongs on page 1 with the title block, and the work the candidate is set does not:
    // the first task has to turn the page, or the contents page becomes the task's own page.
    expect(line("Answer all four tasks.")!.page).toBe(duration.page);
    const task = await generateBrandedPrintablePdf(
      { title: "CIMA OCS Mock Exam 1", intro: "Answer all four tasks.", totalDurationSeconds: 10800, examType: "case_study" },
      [{ sectionNumber: 1, title: "Delivery economics", durationSeconds: 2700, introduction: "Assess the decision." }],
    );
    const taskItems = await extractTextItems(task);
    expect(taskItems.find((item) => item.text.includes("Delivery economics"))!.page).toBeGreaterThan(1);
  });

  it("prints the instructions and table of contents on page 1, above every task", async () => {
    // The introduction is exam-wide, and it is the thing a candidate reads before anything else, so
    // it used to land on page 2 behind the title block — the front of the paper read as a title page
    // and the contents arrived once the work had already started.
    const bytes = await generateBrandedPrintablePdf(
      {
        title: "Cartn Mock Exam 4",
        intro: "<h2>Instructions</h2><p>Answer all tasks.</p><table><tr><th>Section</th><th>Marks</th></tr><tr><td>Task 1</td><td>20</td></tr><tr><td>Task 2</td><td>30</td></tr></table>",
        totalDurationSeconds: 5400,
      },
      [
        { sectionNumber: 1, title: "Delivery economics", durationSeconds: 2700, introduction: "Assess the decision." },
        { sectionNumber: 2, title: "Growth options", durationSeconds: 2700, introduction: "Rank the options." },
      ],
    );
    const items = await extractTextItems(bytes);
    const run = (text: string) => items.find((item) => item.text.trim() === text)!;
    // The whole of the front matter — the instructions and every row of the contents — is page 1.
    // The instructions open under the centred heading the candidate is told to look for.
    for (const text of ["Exam timings and instructions", "Answer all tasks.", "Section", "Marks", "Task 1", "20", "Task 2", "30"]) {
      expect(run(text).page).toBe(1);
    }
    // It reads under the title block rather than being pushed off behind it.
    expect(run("Exam timings and instructions").y).toBeLessThan(run("Time allowed: 1 hour 30 minutes").y);
    // pdfjs reports y upward from the foot of the page, so a lower y is further down the sheet: the
    // brief and the contents sit below the duration rather than above it.
    expect(run("Answer all tasks.").y).toBeLessThan(run("Time allowed: 1 hour 30 minutes").y);
    expect(run("30").y).toBeLessThan(run("Answer all tasks.").y);
    // Both tasks still turn the page, so no task opens halfway down the contents.
    expect(run("Section 1 · Delivery economics [45 minutes]").page).toBeGreaterThan(1);
    expect(run("Section 2 · Growth options [45 minutes]").page).toBeGreaterThan(1);
  });

  it("announces each task once, with its time in the heading", async () => {
    // The sheet used to repeat the cover's "Time allowed" as a meta line under every section
    // heading, so the same sentence appeared once per task plus once on the cover. The time now
    // travels in the heading in brackets, the way the reference papers set "[45 minutes]".
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [
        {
          sectionNumber: 1,
          title: "Delivery economics",
          durationSeconds: 2700,
          introduction: "Read the instruction sheet before you begin.",
          question: "Evaluate the contribution of each region.",
        },
      ],
    );
    const text = await extractText(bytes);
    expect(text).toContain("Section 1 · Delivery economics [45 minutes]");
    expect(text.match(/Time allowed:/g)).toHaveLength(1);
  });

  it("sets a stand-alone sub-task weighting flush right, as a label", async () => {
    // A paragraph that is only "(sub-task (a) = 52%)" labels the requirement above it; set in the
    // paragraph flow it read as prose. The reference papers set these flush right, where the eye
    // lands after the requirement, so the right edge of the measure is the assertion.
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [
        {
          sectionNumber: 1,
          title: "Delivery economics",
          durationSeconds: 2700,
          introduction: "Please address the following:\n(sub-task (a) = 52%)",
          question: null,
        },
      ],
    );
    const items = await extractTextItems(bytes);
    const weight = items.find((item) => item.text.includes("sub-task"));
    expect(weight).toBeDefined();
    expect(weight!.x + weight!.width).toBeGreaterThan(595 - 56.7 - 4);
  });

  it("prints the instruction sheet between the instructions and the task", async () => {
    const png = buildPng(320, 200);
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [
        {
          sectionNumber: 1,
          title: "Delivery economics",
          durationSeconds: 2700,
          introduction: "Read the instruction sheet before you begin.",
          question: "Evaluate the contribution of each region.",
          introAttachments: [{ kind: "instructions", title: "Instruction sheet: task-one-sheet.png", base64: png, mimeType: "image/png" }],
        },
      ],
    );
    const text = await extractText(bytes);
    expect(text).toContain("Instruction sheet: task-one-sheet.png");
    // The instruction sheet stays with the task instructions; the separate task-question prompt is
    // no longer printed as a second brief page.
    expect(text.indexOf("Read the instruction sheet")).toBeLessThan(text.indexOf("Instruction sheet: task-one-sheet.png"));
    expect(text).not.toContain("Evaluate the contribution of each region.");
    expect((await drawnImageWidths(bytes)).length).toBeGreaterThan(1);
  });

  it("lists a PDF instruction sheet and omits the separate task question", async () => {
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [
        {
          sectionNumber: 1,
          title: "Delivery economics",
          durationSeconds: 2700,
          introduction: "Read the instruction sheet before you begin.",
          question: "Evaluate the contribution of each region.",
          introAttachmentTitles: ["Instruction sheet: task-one-sheet.pdf"],
        },
      ],
    );
    const text = await extractText(bytes);
    // A title-only reference has no file to reproduce, so it is named in place. The separately
    // stored task-question prompt is no longer part of the printable brief.
    expect(text).toContain("Instruction sheet: task-one-sheet.pdf");
    expect(text).not.toContain("Evaluate the contribution of each region.");
  });

  it("reproduces a PDF instruction sheet on the page instead of only naming it", async () => {
    // A real single-page PDF, so the bytes parse and the page is actually embedded rather than
    // falling through to the caption-only path.
    const source = await PDFDocument.create();
    const page = source.addPage([595, 842]);
    page.drawText("Contribution by region", { x: 56, y: 760, size: 14, font: await source.embedFont(StandardFonts.Helvetica) });
    const base64 = Buffer.from(await source.save()).toString("base64");

    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [
        {
          sectionNumber: 1,
          title: "Delivery economics",
          durationSeconds: 2700,
          introduction: "Read the instruction sheet before you begin.",
          question: "Evaluate the contribution of each region.",
          introAttachments: [{ kind: "instructions", title: "Instruction sheet: region-data.pdf", base64, mimeType: "application/pdf" }],
        },
      ],
    );
    const text = await extractText(bytes);
    expect(text).toContain("Instruction sheet: region-data.pdf");
    // The whole point of the attachment: its own words are on the sheet, not just its name.
    expect(text).toContain("Contribution by region");
  });

  it("embeds every page of an attached reference PDF in the printable exam", async () => {
    const source = await PDFDocument.create();
    const font = await source.embedFont(StandardFonts.Helvetica);
    source.addPage([595, 842]).drawText("Route diagram · page one", { x: 56, y: 760, size: 14, font });
    source.addPage([595, 842]).drawText("Reference schedule · page two", { x: 56, y: 760, size: 14, font });
    const base64 = Buffer.from(await source.save()).toString("base64");

    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [{
        sectionNumber: 1,
        title: "Delivery economics",
        durationSeconds: 2700,
        attachments: [{ kind: "reference", title: "Reference material: route model.pdf", base64, mimeType: "application/pdf" }],
      }],
    );
    const document = await PDFDocument.load(bytes);
    const text = await extractText(bytes);
    expect(document.getPageCount()).toBeGreaterThan(2);
    expect(text).toContain("Reference material: route model.pdf");
    expect(text).toContain("Route diagram · page one");
    expect(text).toContain("Reference schedule · page two");
  });

  it("falls back to the caption when PDF attachment bytes cannot be parsed", async () => {
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [
        {
          sectionNumber: 1,
          title: "Delivery economics",
          durationSeconds: 2700,
          question: "Evaluate the contribution of each region.",
          introAttachments: [{ kind: "instructions", title: "Instruction sheet: broken.pdf", base64: Buffer.from("%PDF-1.7 truncated").toString("base64"), mimeType: "application/pdf" }],
        },
      ],
    );
    const text = await extractText(bytes);
    expect(text).toContain("Instruction sheet: broken.pdf");
  });

  it("justifies body paragraphs so each line but the last reaches the right margin", async () => {
    // The count is chosen so the paragraph breaks as three lines with a clearly short last one.
    // A round number like 40 packs the final line to the margin anyway, and a full-but-unstretched
    // last line is indistinguishable from a stretched one by its right edge, which would leave this
    // assertion measuring the fixture rather than the justification.
    const words = Array.from({ length: 33 }, (_, index) => `word${index}`);
    const bytes = await generateBrandedPrintablePdf(
      { title: "Alignment", intro: words.join(" "), totalDurationSeconds: 2700 },
      [],
    );
    // Read the drawn runs back and group them by baseline, which is how the sheet is perceived:
    // as lines, each with a left and a right edge.
    const lines = new Map<number, { text: string; right: number }>();
    for (const item of await extractTextItems(bytes)) {
      // The running head and foot sit outside the body area.
      if (item.y < 70 || item.y > 780) continue;
      const key = Math.round(item.y);
      const line = lines.get(key) ?? { text: "", right: 0 };
      line.text += ` ${item.text}`;
      line.right = Math.max(line.right, item.x + item.width);
      lines.set(key, line);
    }
    // Only the intro is paragraph text. The title block shares the band and is deliberately left
    // ragged, since a stretched heading reads as a mistake.
    const paragraph = [...lines.values()].filter((line) => line.text.includes("word"));
    expect(paragraph.length).toBeGreaterThan(2);

    // The right edge of the content column, the same value the printable width test uses.
    const RIGHT_MARGIN = 595 - 56.7;
    const reached = paragraph.filter((line) => line.right > RIGHT_MARGIN - 6);
    // Every line of the paragraph is wrapped from the same column, so all but the closing line
    // should be stretched out to it. Ragged-right output reached none of them, which is the
    // uneven, drifting look the justification is here to remove.
    expect(reached.length).toBe(paragraph.length - 1);
    // Stretching must not push anything past the printable area.
    for (const line of lines.values()) expect(line.right).toBeLessThanOrEqual(RIGHT_MARGIN + 1);
  });

  it("prints the email attachment image with the caption that identifies it", async () => {
    const png = buildPng(900, 1200);
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [{ sectionNumber: 1, title: "Delivery economics", durationSeconds: 2700, attachments: [{ kind: "email", title: "Email attachment image: board minute.png", base64: png, mimeType: "image/png" }] }],
    );
    // An image pushed onto its own page used to leave its caption behind on the previous one.
    const text = await extractText(bytes);
    expect(text).toContain("Email attachment image: board minute.png");
    expect((await drawnImageWidths(bytes)).length).toBeGreaterThan(1);
  });

  it("embeds an attachment image instead of only naming it", async () => {
    const png = buildPng(320, 200);
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [
        {
          sectionNumber: 1,
          title: "Delivery economics",
          durationSeconds: 2700,
          attachmentTitles: ["Reference material: route density extract"],
          attachments: [{ kind: "reference", title: "Reference material: route density extract", base64: png, mimeType: "image/png" }],
        },
      ],
    );
    // The image must be embedded and drawn near its natural size. Scaling it down to whatever
    // space is left produced a 82pt-wide sliver, so the width is what actually catches a regression.
    const drawn = await drawnImageWidths(bytes);
    expect(drawn.length).toBeGreaterThan(1);
    expect(Math.max(...drawn)).toBeGreaterThan(300);
  });

  it("moves an attachment image to its own page instead of squeezing it into leftover space", async () => {
    const png = buildPng(1400, 900);
    // Filler is sized to leave well under the minimum inline height, which is what used to make
    // a tall image collapse to an unreadable strip at the bottom of the text page.
    const filler = Array.from({ length: 18 }, (_, i) => `Filler paragraph ${i + 1} occupying vertical space before the chart.`).join("<br/>");
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [{ sectionNumber: 1, title: "Delivery economics", durationSeconds: 2700, introduction: filler, attachmentTitles: ["Reference material: dense chart"], attachments: [{ kind: "reference", title: "Reference material: dense chart", base64: png, mimeType: "image/png" }] }],
    );
    const drawn = await drawnImageWidths(bytes);
    // Drawn near the full content width, which only happens if the image moved to a new page.
    expect(Math.max(...drawn)).toBeGreaterThan(400);
  });

  it("falls back to the caption when the image bytes cannot be decoded", async () => {
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [{ sectionNumber: 1, title: "Delivery economics", durationSeconds: 2700, attachmentTitles: ["Reference material: broken"], attachments: [{ kind: "reference", title: "Reference material: broken", base64: "bm90LWEtcmVhbC1pbWFnZQ==", mimeType: "image/png" }] }],
    );
    const text = await extractText(bytes);
    // Undecodable bytes must not lose the attachment from the document.
    expect(text).toContain("Reference material: broken");
  });

  it("renders an email body containing lists and bold runs", async () => {
    const html = "<p>Please include:</p><ul><li><strong>(sub-task (a) = 52%)</strong> Explain the budgeted results.</li><li>Explain the benefits of marginal costing.</li></ul>";
    const bytes = await generateBrandedPrintablePdf(
      { title: "CIMA OCS Mock Exam 1", intro: null, totalDurationSeconds: 2700 },
      [{ sectionNumber: 1, title: "Task 1", durationSeconds: 2700, introduction: "Assess the costing decision.", email: { from: "fd@sofa.co.za", to: "smt@sofa.co.za", subject: "Management accounts", html } }],
    );
    const document = await PDFDocument.load(bytes);
    expect(bytes.slice(0, 5).toString()).toBe("%PDF-");
    expect(document.getPageCount()).toBeGreaterThan(0);
  });

  /**
   * The table the studio inserts into a task's instructions is stored as markup in the
   * `introduction` field, and that field is printed through the same HTML path as the email body.
   * These cover the two ways that can go wrong: the tags printing as literal text, or the table
   * swallowing the prose around it.
   */
  it("prints a table inserted into a task's instructions", async () => {
    const introduction =
      "Complete the table below.\n<table>\n<thead>\n<tr><th>Region</th><th>Deliveries</th></tr>\n</thead>\n<tbody>\n<tr><td>Region 1</td><td>1250</td></tr>\n</tbody>\n</table>\nShow your workings.";
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [{ sectionNumber: 1, title: "Task 1", durationSeconds: 2700, introduction }],
    );
    const text = await extractText(bytes);
    expect(text).toContain("Complete the table below.");
    expect(text).toContain("Region");
    expect(text).toContain("Deliveries");
    expect(text).toContain("1250");
    // The paragraph authored after the table has to survive, or the table swallowed the text below it.
    expect(text).toContain("Show your workings.");
    // Markup that failed to parse would print as literal tags in the extracted text.
    expect(text).not.toContain("<th>");
    expect(text).not.toContain("</tr>");
  });

  it("prints the table cells of a task's instructions in every column", async () => {
    // A narrow table is exactly the case where a column gets squeezed to nothing and its text is lost.
    const introduction = "<table><tr><th>Region</th><th>Deliveries</th><th>Contribution</th></tr><tr><td>Region 1</td><td>1250</td><td>225.00</td></tr></table>";
    const bytes = await generateBrandedPrintablePdf(
      { title: "Cartn Mock Exam 4", intro: null, totalDurationSeconds: 2700 },
      [{ sectionNumber: 1, title: "Task 1", durationSeconds: 2700, introduction }],
    );
    const text = await extractText(bytes);
    expect(text).toContain("Deliveries");
    expect(text).toContain("Contribution");
    expect(text).toContain("1250");
    expect(text).toContain("225.00");
  });

  it("prints a table in the exam introduction", async () => {
    const bytes = await generateBrandedPrintablePdf(
      {
        title: "Cartn Mock Exam 4",
        intro: "<p>Answer all tasks.</p><table><tr><th>Section</th><th>Marks</th></tr><tr><td>Task 1</td><td>20</td></tr></table>",
        totalDurationSeconds: 2700,
      },
      [{ sectionNumber: 1, title: "Task 1", durationSeconds: 2700, introduction: "Assess the decision." }],
    );
    const text = await extractText(bytes);
    expect(text).toContain("Answer all tasks.");
    expect(text).toContain("Marks");
    expect(text).toContain("20");
  });
});

describe("parseRichHtml", () => {
  it("keeps bold emphasis as separate runs", () => {
    const blocks = parseRichHtml("<p>Please see <strong>(sub-task (a) = 52%)</strong> for detail.</p>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].marker).toBeNull();
        // The shared parser keeps the gap next to the word it was typed against. The PDF adapter
    // then re-homes it onto the front of the following token, so the sheet draws
    // "Please see (sub-task (a) = 52%) for detail." — where before, the gap was gone from the
    // model and the words printed hard together.
    expect(blocks[0].runs).toEqual([
      { text: "Please see", bold: false },
      { text: " (sub-task (a) = 52%)", bold: true },
      { text: " for detail.", bold: false },
    ]);
    expect(blocks[0].runs.map((run) => run.text).join("")).toBe("Please see (sub-task (a) = 52%) for detail.");
  });

  it("does not insert a space where the markup had none", () => {
    const blocks = parseRichHtml("<p>total<b>cost</b>ing</p>");
    expect(blocks[0].runs).toEqual([
      { text: "total", bold: false },
      { text: "cost", bold: true },
      { text: "ing", bold: false },
    ]);
  });

  it("emits one bulleted block per list item", () => {
    const blocks = parseRichHtml("<p>Please include:</p><ul><li>Explain the differences.</li><li>Explain the benefits.</li></ul>");
    expect(blocks).toHaveLength(3);
    expect(blocks[0].runs.map((run) => run.text).join(" ")).toBe("Please include:");
        expect(blocks[1].marker).toBe("\u2022");
    expect(blocks[1].depth).toBe(0);
    expect(blocks[2].marker).toBe("\u2022");
    expect(blocks[2].depth).toBe(0);
  });

  it("numbers ordered lists and resets nested counters", () => {
    const blocks = parseRichHtml("<ol><li>First</li><li>Second</li></ol><ol><li>Restarted</li></ol>");
    expect(blocks.map((block) => block.marker)).toEqual(["1.", "2.", "1."]);
  });

      it("tracks nesting depth for nested lists", () => {
    const blocks = parseRichHtml("<ul><li>Outer<ul><li>Inner</li></ul></li></ul>");
    // A top-level bullet is depth 0, so the drawn indent starts at the left margin. Counting
    // the lists an item sits inside made the whole list start one step in.
    expect(blocks.map((block) => block.depth)).toEqual([0, 1]);
  });

  it("decodes common HTML entities", () => {
    const blocks = parseRichHtml("<p>Costs &amp; benefits &lt;52%&gt; &nbsp;done &#39;now&#39;</p>");
    expect(blocks[0].runs.map((run) => run.text).join(" ")).toBe("Costs & benefits <52%> done 'now'");
  });

  it("splits paragraphs and treats <br> as a block break", () => {
    const blocks = parseRichHtml("<p>Line one<br />Line two</p><p>Second</p>");
    expect(blocks).toHaveLength(3);
    expect(blocks.map((block) => block.runs[0].text)).toEqual(["Line one", "Line two", "Second"]);
  });

  it("ignores script and style content", () => {
    const blocks = parseRichHtml("<style>ul{list-style:none}</style><p>Body text</p><script>alert(1)</script>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].runs[0].text).toBe("Body text");
  });

  it("returns no blocks for empty input", () => {
    expect(parseRichHtml(null)).toEqual([]);
    expect(parseRichHtml(undefined)).toEqual([]);
    expect(parseRichHtml("")).toEqual([]);
    expect(parseRichHtml("<ul><li></li></ul>")).toEqual([]);
  });

  it("keeps a bullet when the item wraps its text in a paragraph", () => {
    const blocks = parseRichHtml("<ul><li><p>Wrapped item</p></li></ul>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].marker).toBe("\u2022");
    expect(blocks[0].runs[0].text).toBe("Wrapped item");
  });

  it("lifts a table out of the surrounding prose in source order", () => {
    const blocks = parseRichHtml("<p>Before</p><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><p>After</p>");
    expect(blocks).toHaveLength(3);
    expect(blocks[0].runs[0].text).toBe("Before");
    expect(blocks[1].table).toBeDefined();
    // Cells come back as block streams, so each is read through to the single run it holds.
    const cellText = (cell: { runs: { text: string }[] }[]) => cell.map((block) => block.runs[0]?.text).join(" ");
    expect(blocks[1].table!.rows.map((row) => row.map(cellText))).toEqual([["A", "B"], ["1", "2"]]);
    expect(blocks[1].table!.headerRow).toBe(true);
    expect(blocks[2].runs[0].text).toBe("After");
  });

  it("keeps a table authored inside plain text as its own block", () => {
    // Instructions are written as prose with a table dropped into the middle of it, so the text
    // either side of the table is not wrapped in paragraphs. If the surrounding prose merges into
    // the placeholder's block the table never reaches the layout and prints as literal text.
    const blocks = parseRichHtml("Complete the table below.\n<table><tr><th>Region</th></tr><tr><td>Region 1</td></tr></table>\nShow your workings.");
    expect(blocks).toHaveLength(3);
    expect(blocks[0].runs[0].text).toBe("Complete the table below.");
    expect(blocks[1].table).toBeDefined();
    expect(blocks[2].runs[0].text).toBe("Show your workings.");
  });

  it("reads a header row out of the thead the studio inserts", () => {
    const blocks = parseRichHtml("<table><thead><tr><th>Region</th></tr></thead><tbody><tr><td>Region 1</td></tr></tbody></table>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].table!.headerRow).toBe(true);
    expect(blocks[0].table!.rows).toHaveLength(2);
  });
});