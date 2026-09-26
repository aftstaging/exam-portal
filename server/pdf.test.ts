import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateBrandedPrintablePdf } from "./pdf";

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
});