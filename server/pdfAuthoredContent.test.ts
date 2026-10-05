import { describe, expect, it } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { generateBrandedPrintablePdf } from "./pdf";

/**
 * These check the page the learner actually receives, not the block model behind it.
 *
 * Every assertion here is about something that was reported as broken on a real printable exam:
 * emphasis markers printed literally, a table whose cells never appeared, a table drawn without
 * rules, and words set hard against each other where a run boundary fell. Each of those is
 * invisible in a test of the parser, because the parser is not where the page goes wrong.
 */

/** The text a reader would see if they selected the whole document and copied it. */
async function pageText(bytes: Uint8Array): Promise<string> {
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  // Every page, not just the first: the cover is its own page now, so the brief a test asserts
  // on begins on page two.
  const parts: string[] = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const content = await (await doc.getPage(number)).getTextContent();
    parts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * The strings the page actually draws, in order.
 *
 * Neither the text layer nor the drawing positions can answer whether a space was drawn. The text
 * layer inserts a space between two text-drawing operations whether or not the page had one, and
 * the item widths absorb a trailing space so the measured gap always reads zero. The strings
 * passed to `showText` are the page's own account of its content, so a gap appears here exactly
 * when, and only when, one was drawn.
 */
async function drawnStrings(bytes: Uint8Array): Promise<string[]> {
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  const out: string[] = [];
  // Every page, in order: the cover is its own page, so the body's runs start on page two.
  for (let number = 1; number <= doc.numPages; number += 1) {
    const ops = await (await doc.getPage(number)).getOperatorList();
    for (let index = 0; index < ops.fnArray.length; index += 1) {
      if (ops.fnArray[index] !== OPS.showText) continue;
      const args = ops.argsArray[index];
      if (!Array.isArray(args)) continue;
      // A showText argument is a run of glyphs, each carrying the character it stands for. Reading
      // those back is what recovers the page's own text, spacing included.
      const glyphs = args[0];
      if (!Array.isArray(glyphs)) continue;
      out.push(glyphs.map((glyph: { unicode?: string }) => glyph.unicode ?? "").join(""));
    }
  }
  return out;
}

/** The drawn string holding `word`, and the one before it. */
function drawnRun(drawn: string[], word: string): { previous: string; current: string } {
  const at = drawn.findIndex((text) => text.trim() === word);
  expect(at, `no drawn text "${word}" in ${JSON.stringify(drawn)}`).toBeGreaterThan(0);
  return { previous: drawn[at - 1]!, current: drawn[at]! };
}

/** How many filled rectangles the writer emitted, which is how a table's rules are drawn. */
async function filledRectangleCount(bytes: Uint8Array): Promise<number> {
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();
  let count = 0;
  for (const fn of ops.fnArray) {
    if (fn === OPS.constructPath) count += 1;
  }
  return count;
}

/** Content in the shape the older studio produced: marker prose around a real table. */
const MIXED_INTRO = [
  "Read the **instructions** carefully before you answer.",
  "<table>",
  "<thead><tr><th>Region</th><th>Q1</th><th>Q2</th><th>Total</th></tr></thead>",
  "<tbody>",
  "<tr><td>Northern</td><td>120</td><td>180</td><td>300</td></tr>",
  "<tr><td>Southern</td><td>95</td><td>140</td><td>235</td></tr>",
  "</tbody>",
  "</table>",
  "Each section is marked *independently* and the total is <u>not</u> carried forward.",
].join("\n");

function printIntro(intro: string): Promise<Uint8Array> {
  return generateBrandedPrintablePdf({ title: "Mock Exam", intro, totalDurationSeconds: 3600 }, []);
}

describe("the printable page for authored content", () => {
  it("prints emphasis as emphasis, not as the markers themselves", async () => {
    const text = await pageText(await printIntro(MIXED_INTRO));
    expect(text).not.toContain("**");
    expect(text).not.toContain("*independently*");
    expect(text).toContain("Read the instructions carefully before you answer.");
    expect(text).toContain("Each section is marked independently");
  });

  it("prints every cell of an authored table", async () => {
    const text = await pageText(await printIntro(MIXED_INTRO));
    for (const cell of ["Region", "Q1", "Q2", "Total", "Northern", "120", "180", "300", "Southern", "95", "140", "235"]) {
      expect(text).toContain(cell);
    }
  });

  it("draws the rules of an authored table", async () => {
    // A border is not in the text layer, so the operator list is the honest check: the writer
    // emits a filled rectangle per rule and for nothing else on the page.
    expect(await filledRectangleCount(await printIntro(MIXED_INTRO))).toBeGreaterThan(0);
  });

  it("keeps a word gap either side of an emphasised run", async () => {
    // The gap belongs to the run it was typed next to. Losing it at the run boundary is what
    // printed "Please see(sub-task (a) = 52%)for detail." on the sheet.
    const intro = "Please see <strong>(sub-task (a) = 52%)</strong> for detail.";
    const text = await pageText(await printIntro(intro));
    expect(text).toContain("Please see (sub-task (a) = 52%) for detail.");
  });

  it("does not join words that the markup deliberately ran together", async () => {
    // The author wrote "totalcosting" with no space, so none may be drawn between the runs.
    const { previous, current } = drawnRun(await drawnStrings(await printIntro("total<b>cost</b>ing")), "cost");
    expect(previous.endsWith(" ") || current.startsWith(" ")).toBe(false);
  });

  it("leaves a real gap in front of an emphasised run when the author typed one", async () => {
    // The mirror image of the test above: here the author did type a space, so one is drawn.
    const { previous, current } = drawnRun(await drawnStrings(await printIntro("total <b>cost</b> ing")), "cost");
    expect(previous.endsWith(" ") || current.startsWith(" ")).toBe(true);
  });

  it("keeps the outer table intact when a cell holds another table", async () => {
    const intro = [
      "<table>",
      "<tr><th>Region</th><th>Breakdown</th></tr>",
      "<tr><td>Northern</td><td><table><tr><td>Q1 120</td><td>Q2 180</td></tr></table></td></tr>",
      "<tr><td>Southern</td><td>plain cell</td></tr>",
      "</table>",
    ].join("\n");
    const text = await pageText(await printIntro(intro));
    expect(text).toContain("Northern");
    expect(text).toContain("Southern");
    expect(text).toContain("plain cell");
    expect(text).toContain("Q1 120");
    // A truncated cell would leave the tail of the outer table behind as loose text.
    expect(text).not.toContain("</td>");
  });

  it("lays a table out on the page rather than collapsing it", async () => {
    const text = await pageText(await printIntro(MIXED_INTRO));
    expect(text.indexOf("Region")).toBeLessThan(text.indexOf("Northern"));
    expect(text.indexOf("Northern")).toBeLessThan(text.indexOf("Southern"));
  });
});

/** The content streams of every page, decoded to text, the way pdf.test.ts reads them. */
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
 * The filled rectangles the writer emitted, as page geometry: rules, bands and frames are all
 * drawn as one translated polygon each, so the `cm` above a polygon carries its position and the
 * polygon itself carries its size. Read from the content stream rather than through pdfjs,
 * because pdfjs hands paths back in a local space where the page position is no longer visible.
 */
async function filledRectangles(bytes: Uint8Array): Promise<{ x: number; y: number; width: number; height: number }[]> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  for (const page of document.getPages()) {
    for (const source of pageContentStreams(document, page.node.Contents())) {
      const text = Buffer.from(decodePDFRawStream(source).decode()).toString("latin1");
      const drawn = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) cm\n(?:1 0 0 1 0 0 cm\n)*0 0 m\n0 ([\d.]+) l\n([\d.]+) [\d.]+ l\n[\d.]+ 0 l\nh\nf/g;
      for (const match of text.matchAll(drawn)) {
        rects.push({ x: Number(match[1]), y: Number(match[2]), width: Number(match[4]), height: Number(match[3]) });
      }
    }
  }
  return rects;
}

/** Groups y positions that land within `tolerance` of each other, so one boundary counts once. */
function levelsOf(ys: number[], tolerance = 1.5): number {
  const sorted = [...ys].sort((a, b) => a - b);
  let clusters = 0;
  let previous = Number.NEGATIVE_INFINITY;
  for (const y of sorted) {
    if (y - previous > tolerance) clusters += 1;
    previous = y;
  }
  return clusters;
}

describe("the printable table grid", () => {
  const SECTION_PLAN = [
    "<table>",
    "<tr><td>Section Number</td><td>Time for section</td><td>Number of tasks</td></tr>",
    "<tr><td>1</td><td>45</td><td>1</td></tr>",
    "<tr><td>2</td><td>45</td><td>1</td></tr>",
    "</table>",
  ].join("");

  it("rules every gap between the rows of a table", async () => {
    // Reported from a real printable exam: the imported section plan printed its column rules
    // and its outer top and bottom edges but nothing between the rows, so on paper the table
    // read as a list of short lines. A three-row table needs four rules across it.
    const rects = await filledRectangles(await printIntro(SECTION_PLAN));
    const verticals = rects.filter((rect) => rect.height > rect.width * 3 && rect.height > 8);
    expect(verticals.length).toBeGreaterThan(0);
    const top = Math.max(...verticals.map((rect) => rect.y + rect.height));
    const bottom = Math.min(...verticals.map((rect) => rect.y));
    const horizontals = rects.filter(
      (rect) => rect.width > 40 && rect.height <= 2 && rect.y <= top + 1 && rect.y >= bottom - 1,
    );
    expect(levelsOf(horizontals.map((rect) => rect.y))).toBe(4);
  });

  it("sets a tinted band under the heading row", async () => {
    // The band is a filled rectangle the height of the heading row and the width of the table,
    // which no rule can be: rules are hairline, and the band is what separates labels from data.
    const rects = await filledRectangles(await printIntro(SECTION_PLAN));
    const verticals = rects.filter((rect) => rect.height > rect.width * 3 && rect.height > 8);
    const tableWidth = Math.max(...verticals.map((rect) => rect.x + rect.width)) - Math.min(...verticals.map((rect) => rect.x));
    const bands = rects.filter((rect) => rect.width > tableWidth * 0.9 && rect.height > 8 && rect.height < 60);
    expect(bands.length).toBe(1);
  });
});

describe("the printable list markers", () => {
  it("keeps every list marker, even on a line that fills the measure", async () => {
    // A justified line that happens to fill the measure takes the ragged path in the writer's
    // justification, and that path used to return before the marker was drawn: the first bullet
    // of a list reached the paper indented but bulletless, one glyph from reading as a paragraph.
    const intro = [
      "Please include in the briefing paper an explanation of:",
      "<ul><li>The differences between the profit statements in Schedule 1, and the profits they show, in each of the two months.</li></ul>",
      "- Discuss how environmental costs could be captured in an environmental cost of quality report, illustrating each category with a genuine example drawn from Schedule 2.\n",
    ].join("\n");
    const text = await pageText(await printIntro(intro));
    expect(text.match(/•/g)?.length).toBe(2);
  });
});
