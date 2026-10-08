import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateSubmissionPdf } from "./pdf";

describe("submission PDF", () => {
  it("writes the learner's answers and marks as a PDF", async () => {
    const bytes = await generateSubmissionPdf({
      title: "CIMA OCS Mock Exam 1",
      examType: "case_study",
      learner: "Thandi Dlamini · thandi@example.test",
      submittedAt: "8 Oct 2026, 10:14",
      statusLabel: "Marked",
      sections: [
        { sectionNumber: 1, title: "Delivery economics", html: "<p>The <strong>first</strong> answer & a <em>note</em>.</p><ul><li>point one</li></ul>", wordCount: 9 },
        { sectionNumber: 2, title: "Growth options", html: null, wordCount: 0 },
      ],
      marking: { awardedPoints: 14, totalPoints: 20, percent: 70, feedback: "Good analysis of costs." },
    });
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe("Submission · CIMA OCS Mock Exam 1");
  });
});
