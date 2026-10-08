import { describe, expect, it } from "vitest";
import { linesFromItems, linesToHtml, sniffKind, textToHtml } from "./documentText";
import { draftFromHtml } from "./documentImport";

describe("linesToHtml", () => {
  it("rebuilds a two-column grid as a table", () => {
    const items = [
      { str: "Rate", x: 50, y: 700, width: 20 },
      { str: "Value", x: 300, y: 700, width: 25 },
      { str: "Tax", x: 50, y: 680, width: 15 },
      { str: "20%", x: 300, y: 680, width: 18 },
    ];
    const html = linesToHtml(linesFromItems(items));
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Rate</th>");
    expect(html).toContain("<td>20%</td>");
  });

  it("keeps prose as paragraphs when there is no column structure", () => {
    const items = [
      { str: "A plain sentence that runs across the page", x: 50, y: 700, width: 280 },
      { str: "and continues on the next line.", x: 50, y: 686, width: 190 },
    ];
    const html = linesToHtml(linesFromItems(items));
    expect(html).not.toContain("<table>");
    expect(html).toContain("<p>A plain sentence that runs across the page</p>");
  });

  it("joins items that sit close together into one cell", () => {
    const lines = linesFromItems([
      { str: "Net", x: 50, y: 700, width: 14 },
      { str: "profit", x: 66, y: 700, width: 30 },
    ]);
    expect(lines[0]!.cells).toEqual([{ x: 50, text: "Net profit" }]);
  });
});

describe("textToHtml", () => {
  it("turns Markdown pipe tables into tables and bullets into paragraphs", () => {
    const html = textToHtml("| Name | Value |\n|---|---|\n| Rate | 12% |\n\n- first point");
    expect(html).toContain("<th>Name</th>");
    expect(html).toContain("<td>12%</td>");
    expect(html).toContain("<p>• first point</p>");
    expect(html).not.toContain("---");
  });

  it("escapes author text", () => {
    expect(textToHtml("Tom & <Jerry>")).toContain("Tom &amp; &lt;Jerry&gt;");
  });
});

describe("sniffKind", () => {
  it("recognises formats by content before extension", () => {
    expect(sniffKind(Buffer.from("%PDF-1.7 rest"), "file.bin")).toBe("pdf");
    expect(sniffKind(Buffer.from([0x50, 0x4b, 3, 4]), "anything")).toBe("docx");
    expect(sniffKind(Buffer.from("hello"), "notes.md")).toBe("text");
    expect(sniffKind(Buffer.from("<p>x</p>"), "page.html")).toBe("html");
  });
});

describe("draftFromHtml", () => {
  it("splits the brief from tasks found by heading", () => {
    const draft = draftFromHtml(
      "Mock_Exam_1.docx",
      "<p>Read the brief.</p><p><strong>Task 1 - Ledger review</strong></p><p>Do part one.</p><p>Task 2: Memo</p><p>Write it.</p>",
    );
    expect(draft.title).toBe("Mock Exam 1");
    expect(draft.intro).toContain("Read the brief.");
    expect(draft.caseStudySections).toHaveLength(2);
    expect(draft.caseStudySections![0]!.title).toBe("Ledger review");
    expect(draft.caseStudySections![0]!.introduction).toContain("Do part one.");
    expect(draft.caseStudySections![1]!.title).toBe("Memo");
  });

  it("treats the whole document as the brief when there are no task headings", () => {
    const draft = draftFromHtml("notes.txt", "<p>Just text.</p>");
    expect(draft.caseStudySections).toEqual([]);
    expect(draft.intro).toContain("Just text.");
  });
});
