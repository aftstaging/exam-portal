import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { generateBrandedPrintablePdf, parseRichHtml } from "./pdf";

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

/** Reads back the drawn text with the position and drawn width of each item, for layout assertions. */
async function extractTextItems(bytes: Uint8Array): Promise<{ text: string; x: number; y: number; width: number }[]> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const items: { text: string; x: number; y: number; width: number }[] = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const content = await (await doc.getPage(number)).getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      items.push({ text: item.str, x: item.transform[4] as number, y: item.transform[5] as number, width: (item as { width?: number }).width ?? 0 });
    }
  }
  return items;
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

describe("branded printable exam PDF", () => {
  it("creates a readable PDF with exam and section content", async () => {
    const bytes = await generateBrandedPrintablePdf({ title: "Cartn Mock Exam 4", intro: "Imported case-study mock", totalDurationSeconds: 10800 }, [{ sectionNumber: 1, title: "Digital data sources", durationSeconds: 2700, introduction: "Assess the decision context." }]);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(0);
    expect(bytes.slice(0, 5).toString()).toBe("%PDF-");
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
});

describe("parseRichHtml", () => {
  it("keeps bold emphasis as separate runs", () => {
    const blocks = parseRichHtml("<p>Please see <strong>(sub-task (a) = 52%)</strong> for detail.</p>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].marker).toBeNull();
    expect(blocks[0].runs).toEqual([
      { text: "Please see", bold: false },
      { text: "(sub-task (a) = 52%)", bold: true },
      { text: "for detail.", bold: false },
    ]);
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
    expect(blocks[1].depth).toBe(1);
    expect(blocks[2].marker).toBe("\u2022");
    expect(blocks[2].depth).toBe(1);
  });

  it("numbers ordered lists and resets nested counters", () => {
    const blocks = parseRichHtml("<ol><li>First</li><li>Second</li></ol><ol><li>Restarted</li></ol>");
    expect(blocks.map((block) => block.marker)).toEqual(["1.", "2.", "1."]);
  });

  it("tracks nesting depth for nested lists", () => {
    const blocks = parseRichHtml("<ul><li>Outer<ul><li>Inner</li></ul></li></ul>");
    const depths = blocks.map((block) => block.depth);
    expect(Math.max(...depths)).toBe(2);
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
});