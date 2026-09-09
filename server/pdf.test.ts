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
});