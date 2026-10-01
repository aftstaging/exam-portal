import { describe, expect, it } from "vitest";
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

/** The text a reader would see if they selected the whole page and copied it. */
async function pageText(bytes: Uint8Array): Promise<string> {
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s+/g, " ").trim();
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
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();
  const out: string[] = [];
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
