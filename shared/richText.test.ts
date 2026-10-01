import { describe, expect, it } from "vitest";
import {
  normalizeAuthoredHtml,
  parseRichHtml,
  richTextToPlainText,
  sanitizeAuthoredHtml,
  type RichBlock,
} from "./richText";

/** The block types a field is expected to produce, ignoring which text carries the detail. */
function kinds(blocks: RichBlock[]): string[] {
  return blocks.map((block) => block.kind);
}

function textOf(block: RichBlock): string {
  return block.runs.map((run) => run.text).join("");
}

describe("normalizeAuthoredHtml", () => {
  it("converts markers in prose", () => {
    expect(normalizeAuthoredHtml("Read the **instructions** carefully.")).toBe(
      "<p>Read the <strong>instructions</strong> carefully.</p>",
    );
  });

  it("converts every inline marker", () => {
    const html = normalizeAuthoredHtml("**b** *i* __u__ ~~s~~");
    expect(html).toContain("<strong>b</strong>");
    expect(html).toContain("<em>i</em>");
    expect(html).toContain("<u>u</u>");
    expect(html).toContain("<s>s</s>");
  });

  it("converts markers in a field that also carries real formatting tags", () => {
    // The shape of exam content in practice: prose in markers, one phrase already an element.
    const html = normalizeAuthoredHtml("Read the **instructions** and keep the <u>marked</u> line.");
    expect(html).toContain("<strong>instructions</strong>");
    expect(html).toContain("<u>marked</u>");
  });

  it("leaves a tag the author wrote exactly as it was", () => {
    const html = normalizeAuthoredHtml("A <em>word</em> and **emphasis**");
    expect(html).toBe("<p>A <em>word</em> and <strong>emphasis</strong></p>");
  });

  it("does not rewrite asterisks that sit inside a tag", () => {
    const html = normalizeAuthoredHtml('<p title="a**b">text</p>');
    expect(html).toContain('title="a**b"');
    expect(html).not.toContain("<strong>");
  });

  it("keeps a table while converting markers around it", () => {
    const html = normalizeAuthoredHtml(
      ["**Marks**", "<table><tr><th>Q1</th></tr><tr><td>10</td></tr></table>", "and *more*"].join("\n"),
    );
    expect(html).toContain("<strong>Marks</strong>");
    expect(html).toContain("<em>more</em>");
    expect(html).toContain("<th>Q1</th>");
  });

  it("does not escape entities that were already HTML", () => {
    expect(normalizeAuthoredHtml("<p>one &amp; two</p>")).toBe("<p>one &amp; two</p>");
  });

  it("escapes a less-than that does not open a tag", () => {
    const html = normalizeAuthoredHtml("a < b and **bold**");
    expect(html).toContain("&lt;");
    expect(html).not.toContain("a < b");
  });

  it("converts headings and lists", () => {
    const html = normalizeAuthoredHtml("## Marks\n- one\n- two\n1. first");
    const joined = html.replace(/\n/g, "");
    expect(html).toContain("<h2>Marks</h2>");
    expect(joined).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(joined).toContain("<ol><li>first</li></ol>");
  });

  it("never leaks the placeholder it parks a table in", () => {
    // The table is set aside while the rest of the field is converted, so a table whose markup
    // spans many lines is not read as a run of empty paragraphs. The marker that does the parking
    // must not survive into the result.
    const html = normalizeAuthoredHtml("before\n<table>\n<tr><td>x</td></tr>\n</table>\nafter");
    expect(html).not.toContain("AFT_TABLE");
    expect(html).not.toContain("\u0000");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>x</td>");
  });

  it("puts a table back on the line it shared, with the prose around it", () => {
    const html = normalizeAuthoredHtml("The marks are <table><tr><td>10</td></tr></table> in total.");
    expect(html).toContain("The marks are");
    expect(html).toContain("<td>10</td>");
    expect(html).toContain("in total.");
  });

  it("handles empty input", () => {
    expect(normalizeAuthoredHtml("")).toBe("");
    expect(normalizeAuthoredHtml(null)).toBe("");
    expect(normalizeAuthoredHtml(undefined)).toBe("");
  });
});

describe("parseRichHtml", () => {
  it("reads emphasis into runs", () => {
    const [block] = parseRichHtml("<p>a <strong>b</strong> c <em>d</em></p>");
    // Only the block's own two edges are trimmed, so the gap either side of an emphasised word
    // stays where the author put it. Trimming every run ran the words together, which is the
    // defect that produced "Read theinstructionscarefully" on the page.
    expect(block!.runs).toEqual([
      { text: "a ", bold: false, italic: false, underline: false, strike: false },
      { text: "b", bold: true, italic: false, underline: false, strike: false },
      { text: " c ", bold: false, italic: false, underline: false, strike: false },
      { text: "d", bold: false, italic: true, underline: false, strike: false },
    ]);
    expect(block!.runs.map((run) => run.text).join("")).toBe("a b c d");
  });

  it("keeps the word gap either side of an emphasised word", () => {
    const [block] = parseRichHtml("<p>Read the <strong>instructions</strong> carefully.</p>");
    expect(block!.runs.map((run) => run.text).join("")).toBe("Read the instructions carefully.");
  });

  it("keeps a lone space between two emphasised words", () => {
    const [block] = parseRichHtml("<p><strong>a</strong> <em>b</em></p>");
    expect(block!.runs.map((run) => run.text).join("")).toBe("a b");
  });

  it("marks underline and strike runs", () => {
    const [block] = parseRichHtml("<p><u>u</u> <s>g</s></p>");
    expect(block!.runs.find((run) => run.underline)!.text).toBe("u");
    expect(block!.runs.find((run) => run.strike)!.text).toBe("g");
  });

  it("combines bold and italic in one run", () => {
    const [block] = parseRichHtml("<p><strong><em>x</em></strong></p>");
    expect(block!.runs[0]!.bold).toBe(true);
    expect(block!.runs[0]!.italic).toBe(true);
  });

  it("lifts a table out of the surrounding prose in source order", () => {
    const blocks = parseRichHtml("<p>Before</p><table><tr><td>A</td></tr></table><p>After</p>");
    expect(kinds(blocks)).toEqual(["paragraph", "table", "paragraph"]);
  });

  it("lifts a table that shared a line with a sentence", () => {
    // The defect that put raw markup on the learner's screen: a table on the same line as prose
    // used to fall through the line splitter and be shown as text.
    const blocks = parseRichHtml("<p>The marks are:</p><table><tr><th>Region</th></tr><tr><td>North</td></tr></table>");
    const table = blocks.find((block) => block.kind === "table");
    expect(table).toBeDefined();
    expect(table!.table!.rows[0]![0]![0]!.runs[0]!.text).toBe("Region");
    expect(table!.table!.rows[1]![0]![0]!.runs[0]!.text).toBe("North");
  });

  it("keeps a table that sits inside a paragraph element", () => {
    const blocks = parseRichHtml("<p>Lead in <table><tr><td>x</td></tr></table> and after.</p>");
    expect(kinds(blocks)).toContain("table");
  });

  it("parses a table with a heading row and nested blocks in a cell", () => {
    const blocks = parseRichHtml(
      "<table><tr><th>Head</th></tr><tr><td><p>one</p><p>two</p></td></tr></table>",
    );
    const table = blocks.find((block) => block.kind === "table")!.table!;
    expect(table.headerRow).toBe(true);
    expect(table.rows[1]![0]!.map((block) => block.kind)).toEqual(["paragraph", "paragraph"]);
  });

  it("pads nothing and reports the true column count", () => {
    const table = parseRichHtml("<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>").find(
      (block) => block.kind === "table",
    )!.table!;
    expect(table.rows[0]).toHaveLength(2);
    expect(table.rows[1]).toHaveLength(1);
  });

  it("reads lists, including nested ones", () => {
    const blocks = parseRichHtml("<ul><li>one</li><li>two<ul><li>deep</li></ul></li></ul>");
    const items = blocks.filter((block) => block.kind === "listItem");
    expect(items.map(textOf)).toEqual(["one", "two", "deep"]);
    expect(items[0]!.ordered).toBe(false);
    expect(items[2]!.depth).toBe(1);
  });

  it("reads an ordered list", () => {
    const blocks = parseRichHtml("<ol><li>first</li><li>second</li></ol>");
    const items = blocks.filter((block) => block.kind === "listItem");
    expect(items.every((item) => item.ordered)).toBe(true);
  });

  it("keeps a list item whose only child is a paragraph", () => {
    const blocks = parseRichHtml("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    expect(blocks.filter((block) => block.kind === "listItem").map(textOf)).toEqual(["one", "two"]);
  });

  it("reads headings with their level", () => {
    const blocks = parseRichHtml("<h2>Title</h2><h3>Sub</h3>");
    expect(blocks[0]!.kind).toBe("heading");
    expect(blocks[0]!.level).toBe(2);
    expect(blocks[1]!.level).toBe(3);
  });

  it("reads every alignment and leaves an unset one unset", () => {
    expect(parseRichHtml('<p style="text-align:center">c</p>')[0]!.align).toBe("center");
    expect(parseRichHtml('<p style="text-align:right">r</p>')[0]!.align).toBe("right");
    expect(parseRichHtml('<p style="text-align:justify">j</p>')[0]!.align).toBe("justify");
    expect(parseRichHtml('<p style="text-align:left">l</p>')[0]!.align).toBe("left");
    expect(parseRichHtml("<p>plain</p>")[0]!.align).toBeUndefined();
  });

  it("keeps a hard line break inside a paragraph", () => {
    const [block] = parseRichHtml("<p>one<br>two</p>");
    expect(block!.runs[0]!.text).toBe("one\ntwo");
  });

  it("reads a horizontal rule", () => {
    expect(kinds(parseRichHtml("<p>a</p><hr /><p>b</p>"))).toEqual(["paragraph", "rule", "paragraph"]);
  });

  it("reads a link as its visible text", () => {
    const [block] = parseRichHtml('<p>see <a href="https://example.com">the guide</a></p>');
    expect(textOf(block!)).toBe("see the guide");
  });

  it("falls back to legacy markers for a plain-text field", () => {
    const blocks = parseRichHtml("Read the **instructions** carefully.");
    expect(blocks[0]!.runs[1]!.bold).toBe(true);
    expect(blocks[0]!.runs[1]!.text).toBe("instructions");
  });

  it("reads a whole field that mixes markers, a table and a formatting tag", () => {
    const blocks = parseRichHtml(
      [
        "Read the **instructions** carefully before you answer.",
        "<table>",
        "<tr><th>Region</th><th>Total</th></tr>",
        "<tr><td>Northern</td><td>300</td></tr>",
        "</table>",
        "Marked *independently* and the <u>total</u> is not carried forward.",
      ].join("\n"),
    );
    expect(kinds(blocks)).toEqual(["paragraph", "table", "paragraph"]);
    const [prose, , tail] = blocks;
    expect(prose!.runs.map((run) => run.text).join("")).toBe(
      "Read the instructions carefully before you answer.",
    );
    expect(prose!.runs[1]!.bold).toBe(true);
    expect(tail!.runs.map((run) => run.text).join("")).toBe(
      "Marked independently and the total is not carried forward.",
    );
    expect(tail!.runs.some((run) => run.italic)).toBe(true);
    expect(tail!.runs.some((run) => run.underline)).toBe(true);
  });

  it("renders a nested table inside a cell", () => {
    const table = parseRichHtml(
      "<table><tr><td><table><tr><td>inner</td></tr></table></td><td>outer</td></tr></table>",
    ).find((block) => block.kind === "table")!.table!;
    const inner = table.rows[0]![0]!.find((block) => block.kind === "table");
    expect(inner).toBeDefined();
    expect(inner!.table!.rows[0]![0]![0]!.runs[0]!.text).toBe("inner");
  });
});

describe("sanitizeAuthoredHtml", () => {
  it("drops a script tag and its contents", () => {
    expect(sanitizeAuthoredHtml("<p>ok</p><script>alert(1)</script>")).not.toContain("script");
  });

  it("drops an event handler", () => {
    expect(sanitizeAuthoredHtml('<p onclick="alert(1)">x</p>')).not.toContain("onclick");
  });

  it("keeps the formatting tags an author needs", () => {
    for (const tag of ["strong", "em", "u", "s", "p", "br", "h2", "h3", "ul", "ol", "li", "table", "th", "td"]) {
      expect(sanitizeAuthoredHtml(`<${tag}>x</${tag}>`)).toContain(`<${tag}`);
    }
  });

  it("keeps a safe link and drops an unsafe one", () => {
    expect(sanitizeAuthoredHtml('<a href="https://example.com">x</a>')).toContain("https://example.com");
    expect(sanitizeAuthoredHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
  });
});

describe("richTextToPlainText", () => {
  it("flattens a table to its cell text", () => {
    const text = richTextToPlainText("<table><tr><th>Region</th></tr><tr><td>North</td></tr></table>");
    expect(text).toContain("Region");
    expect(text).toContain("North");
    expect(text).not.toContain("<");
  });
});
