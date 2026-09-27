import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateBrandedPrintablePdf, parseRichHtml } from "./pdf";

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