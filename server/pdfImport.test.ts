import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { formatPageRanges, linesToHtml, stripRunningHeaders } from "./pdfImport";

const base = fileURLToPath(new URL("../source-pdfs/", import.meta.url));

function staffCaller() {
  return appRouter.createCaller({
    user: { id: 9999, role: "admin" } as TrpcContext["user"],
    req: { protocol: "https", get: () => "portal.test" } as never,
    res: { clearCookie: () => undefined } as never,
  } satisfies TrpcContext);
}

function learnerCaller() {
  return appRouter.createCaller({
    user: { id: 9999, role: "user" } as TrpcContext["user"],
    req: { protocol: "https", get: () => "portal.test" } as never,
    res: { clearCookie: () => undefined } as never,
  } satisfies TrpcContext);
}

function uploadArgs(name: string) {
  const raw = readFileSync(`${base}${name}`);
  return { fileName: name, mimeType: "application/pdf", base64: `data:application/pdf;base64,${raw.toString("base64")}` };
}

async function buildPdf(pages: string[][]): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([595, 842]);
    lines.forEach((line, index) => page.drawText(line, { x: 48, y: 800 - index * 22, size: 12, font }));
  }
  const bytes = await doc.save();
  return Buffer.from(bytes).toString("base64");
}

function syntheticArgs(name: string, base64String: string) {
  return { fileName: name, mimeType: "application/pdf", base64: `data:application/pdf;base64,${base64String}` };
}

/**
 * Budget for the tests that import a real multi-page paper.
 *
 * These run pdfjs over full exam fixtures and take 1-3s alone, which overruns vitest's 5s
 * default when the suite runs in parallel. The ceiling is set per test rather than via
 * `testTimeout` so the cheap rejection tests above keep failing fast on a real regression.
 */
const REAL_PAPER_TIMEOUT_MS = 30_000;

describe("exams.createFromPdf — import exam papers from a PDF", () => {
  it("rejects learner and anonymous callers with FORBIDDEN", async () => {
    const learner = learnerCaller();
    await expect(learner.exams.createFromPdf(uploadArgs("cartn-mock-3-questions.pdf"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an unsupported file type", async () => {
    await expect(staffCaller().exams.createFromPdf({ fileName: "paper.exe", mimeType: "application/octet-stream", base64: "aGVsbG8=" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: /Import a PDF, Word, text, Markdown, HTML or image file/ });
  });

  it("imports a text file as an exam draft", async () => {
    const draft = await staffCaller().exams.createFromPdf({ fileName: "paper.txt", mimeType: "text/plain", base64: Buffer.from("Read the brief.\n\nTask 1 - Review\n\nDo it.").toString("base64") });
    expect(draft.title).toBe("paper");
    expect(draft.intro).toContain("Read the brief.");
    expect(draft.caseStudySections?.[0]?.title).toBe("Review");
  });

  it("surfaces unreadable files as a bad request", async () => {
    await expect(staffCaller().exams.createFromPdf({ fileName: "broken.pdf", mimeType: "application/pdf", base64: "not-a-pdf" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: /Could not read this PDF/i });
  });

  it("extracts the Cartn Mock Exam 3 case study into tasks, email, and resources", async () => {
    const draft = await staffCaller().exams.createFromPdf(uploadArgs("cartn-mock-3-questions.pdf"));
    expect(draft.isSolutionsDocument).toBe(false);
    expect(draft.examType).toBe("case_study");
    expect(draft.title).toBe("Cartn Mock Exam 3");
    expect(draft.totalDurationSeconds).toBe(10800);
    expect(draft.preModeratedPdf?.fileName).toBe("cartn-mock-3-questions.pdf");
    expect(draft.emailFrom).toBe("Elizabeth Maenda, Senior Financial Manager");
    expect(draft.emailSubject).toBeTruthy();
    expect(draft.emailText?.length).toBeGreaterThan(500);
    expect(draft.reference?.fileName).toBe("cartn-mock-3-questions-reference.pdf");
    expect(draft.formulae?.fileName).toBe("cartn-mock-3-questions-formulae-tables.pdf");
    expect(draft.preSeen).toBeNull();
    const sections = draft.caseStudySections ?? [];
    expect(sections).toHaveLength(4);
    sections.forEach((section, index) => {
      expect(section.title).toBe(`Task ${index + 1} — Unseen case material`);
      expect(section.durationSeconds).toBe(2700);
      // Each task carries its own brief: the intro line plus the composed email,
      // and its own reference-material pages carved out of the paper.
      expect(section.introduction).toContain("You received the following email");
      expect(section.emailFrom).toBe("Elizabeth Maenda, Senior Financial Manager");
      expect(section.emailTo).toBe("Financial Manager");
      expect(section.emailSubject).toBeTruthy();
      expect(section.emailText ?? "").toMatch(/<ul><li>/);
      expect(section.emailText ?? "").toContain("Kind regards");
      expect(section.emailText?.length ?? 0).toBeGreaterThan(500);
      expect(section.reference?.fileName).toBe(`cartn-mock-3-questions-task-${index + 1}-reference.pdf`);
    });
  }, REAL_PAPER_TIMEOUT_MS);

  it("extracts the Cartn Mock Exam 4 case study with per-task emails and reference material", async () => {
    const draft = await staffCaller().exams.createFromPdf(uploadArgs("cartn-mock-4-questions.pdf"));
    expect(draft.isSolutionsDocument).toBe(false);
    expect(draft.title).toBe("Cartn Mock Exam 4");
    expect(draft.examType).toBe("case_study");
    expect(draft.totalDurationSeconds).toBe(10800);
    expect(draft.reference?.fileName).toBe("cartn-mock-4-questions-reference.pdf");
    expect(draft.formulae?.fileName).toBe("cartn-mock-4-questions-formulae-tables.pdf");
    expect(draft.emailText?.length).toBeGreaterThan(500);
    const sections = draft.caseStudySections ?? [];
    expect(sections).toHaveLength(4);
    // Every task's email brief is picked up with its own headers …
    expect(sections.map((section) => section.emailSubject)).toEqual([
      "Digital Data Sources and Quality Management",
      "Circular Business Model and Stakeholders",
      "Measuring Risk and Project Management Tools and Techniques",
      "Plant Alpha Accounting Treatment and Conflict Resolution",
    ]);
    sections.forEach((section) => {
      expect(section.emailFrom).toBe("Elizabeth Maenda, Senior Financial Manager");
      expect(section.emailTo).toBe("Financial Manager");
    });
    // … and the body keeps the document's own formatting: greeting paragraph,
    // bullet list with the sub-task weightings, and the sign-off block.
    const body = sections[0]?.emailText ?? "";
    expect(body).toContain("<p>Hi,</p>");
    expect(body).toMatch(/<ul><li>/);
    expect(body).toContain("[sub-task (a) = 40%]");
    expect(body).toContain("[sub-task (b) = 60%]");
    expect(body).toContain("Kind regards");
    expect(body).toContain("Elizabeth");
    expect(body).not.toContain("Astranti");
    expect(sections[0]?.introduction ?? "").toContain("new government regulation in Harrland");
    // Reference material is attached per task, carved from that task's own pages.
    sections.forEach((section, index) => {
      expect(section.reference?.fileName).toBe(`cartn-mock-4-questions-task-${index + 1}-reference.pdf`);
      expect(section.reference?.base64.length ?? 0).toBeGreaterThan(64);
    });
  }, REAL_PAPER_TIMEOUT_MS);

  it("extracts the CIMA MCS Mock B case study with task titles and resources", async () => {
    const draft = await staffCaller().exams.createFromPdf(uploadArgs("cima-mock-b-questions.pdf"));
    expect(draft.isSolutionsDocument).toBe(false);
    expect(draft.title).toBe("Mock Exam B — May & August 2026");
    expect(draft.examType).toBe("case_study");
    expect(draft.totalDurationSeconds).toBe(10800);
    const sections = draft.caseStudySections ?? [];
    expect(sections).toHaveLength(4);
    sections.forEach((section, index) => expect(section.title).toBe(`Task ${index + 1}`));
    expect(draft.reference?.fileName).toBe("cima-mock-b-questions-reference.pdf");
    expect(draft.formulae?.fileName).toBe("cima-mock-b-questions-formulae-tables.pdf");
    expect(draft.emailSubject).toMatch(/^Cartn trays/);
    // Kaplan prints the recipient above the sender — both must land in the compose fields.
    expect(sections[1]?.emailSubject).toBe("Cartn trays");
    expect(sections[1]?.emailFrom).toBe("Elizabeth Maenda");
    expect(sections[1]?.emailTo).toBe("Financial Manager");
    expect(sections[1]?.emailText ?? "").toMatch(/<ul><li>/);
    sections.forEach((section, index) => {
      expect(section.reference?.fileName).toBe(`cima-mock-b-questions-task-${index + 1}-reference.pdf`);
    });
  }, REAL_PAPER_TIMEOUT_MS);

  it("treats solutions and marking-guide PDFs as the feedback document without building sections", async () => {
    for (const name of ["cartn-mock-3-solutions.pdf", "cartn-mock-4-solutions.pdf", "cima-mock-b-answers-marking-guide.pdf"]) {
      const draft = await staffCaller().exams.createFromPdf(uploadArgs(name));
      expect(draft.isSolutionsDocument).toBe(true);
      expect(draft.caseStudySections ?? []).toHaveLength(0);
      expect(draft.objectiveQuestions ?? []).toHaveLength(0);
      expect(draft.feedbackFile?.fileName).toBe(name);
      expect(draft.notes).toContain("This file looks like a suggested-solutions / answers / marking-guide document — nothing in it was treated as exam content.");
    }
  }, REAL_PAPER_TIMEOUT_MS);

  it("does not treat a mock-exam question paper as a solutions document when its cover mentions suggested answers", async () => {
    const base64 = await buildPdf([
      ["CIMA Management Case Study", "Mock Exam 7", "A set of suggested answers is available separately."],
      ["Management Case Study Mock Exam 7", "Task 1 - Unseen case material [45 minutes]", "You received the following email:", "From: Elizabeth Maenda", "To: Financial Manager", "Subject: Costing", "Hi,", "Please evaluate the costing options for Cartn."],
    ]);
    const draft = await staffCaller().exams.createFromPdf(syntheticArgs("accountants_for_tomorrow_lumencare_mock_exam.pdf", base64));
    expect(draft.isSolutionsDocument).toBe(false);
    expect(draft.caseStudySections ?? []).toHaveLength(1);
  });

  it("carves a detected pre-seen section into the Pre-seen attachment", async () => {
    const base64 = await buildPdf([
      ["CIMA Management Case Study", "Mock Exam 5", "Cartn", "Unseen [3 hours]"],
      ["Management Case Study Mock Exam 5", "Pre-seen material", "Cartn is a packaging and advisory company specialising in food-grade cartons."],
      ["Management Case Study Mock Exam 5", "Task 1 - Unseen case material [45 minutes]", "You received the following email:", "From: Elizabeth Maenda, Senior Financial Manager", "To: Financial Manager", "Subject: Fruitello Recall", "Hi,", "Please review the attached news article on the Fruitello recall and identify the reputational risks to Cartn."],
      ["Management Case Study Mock Exam 5", "Task 2 - Unseen case material [45 minutes]", "You received the following email:", "From: Elizabeth Maenda, Senior Financial Manager", "To: Financial Manager", "Subject: HoloScan", "Hi,", "Please evaluate the arguments for and against the HoloScan proposal."],
    ]);
    const draft = await staffCaller().exams.createFromPdf(syntheticArgs("mock-exam-5-questions.pdf", base64));
    expect(draft.examType).toBe("case_study");
    expect(draft.title).toBe("Cartn Mock Exam 5");
    expect(draft.preSeen?.fileName).toBe("mock-exam-5-questions-pre-seen.pdf");
    expect(draft.preSeen?.base64.length).toBeGreaterThan(64);
    expect(draft.reference).toBeNull();
    expect(draft.formulae).toBeNull();
    expect(draft.caseStudySections ?? []).toHaveLength(2);
    expect(draft.notes).toContainEqual(expect.stringMatching(/pre-seen \/ advance-information section was detected/i));
  });

  it("reports skipped unclassified pages as readable ranges", async () => {
    const base64 = await buildPdf([
      ["CIMA Management Case Study", "Mock Exam 6", "Cartn", "Unseen [3 hours]"],
      ["Management Case Study Mock Exam 6", "Task 1 - Unseen case material [45 minutes]", "You received the following email:", "From: Elizabeth Maenda", "To: Financial Manager", "Subject: Annual review", "Hi,", "Please evaluate the risks to Cartn from the annual report."],
      ["Management Case Study Mock Exam 6", "Appendix A - Full income statement", "Revenue 500000", "Cost of sales 320000", "Appendix A continues"],
    ]);
    const draft = await staffCaller().exams.createFromPdf(syntheticArgs("mock-exam-6-questions.pdf", base64));
    expect(draft.caseStudySections ?? []).toHaveLength(1);
    const note = draft.notes.find((entry) => /were not recognised/i.test(entry));
    expect(note).toBeDefined();
    expect(note).toContain("Pages 3");
  });
});

describe("pdfImport helpers", () => {
  it("strips known running headers and footers without touching body text", () => {
    const stripped = stripRunningHeaders("MO CK B KAPLAN PUBLISHING 7 TASK 1 (45 minutes) TRIGGER Body text stays here");
    expect(stripped).not.toMatch(/MO\s+CK\s+B/i);
    expect(stripped).not.toContain("KAPLAN");
    expect(stripped).toContain("TASK 1 (45 minutes) TRIGGER Body text stays here");
  });

  it("strips the CIMA and Astranti running headers", () => {
    const stripped = stripRunningHeaders("CIMA MANAGE MENT LEVEL CASE ST UDY (MAY AND AUGUST 2026) Management Case Study Mock Exam 3 © Astranti 2026 Task content remains");
    expect(stripped).not.toContain("CIMA MANAGE");
    expect(stripped).not.toContain("Case Study Mock Exam 3");
    expect(stripped).not.toContain("Astranti");
    expect(stripped).toContain("Task content remains");
  });

  it("formats page lists as compact ranges", () => {
    expect(formatPageRanges([2, 3, 4, 7])).toBe("2–4, 7");
    expect(formatPageRanges([3])).toBe("3");
    expect(formatPageRanges([1, 2])).toBe("1–2");
    expect(formatPageRanges([])).toBe("");
  });

  it("rebuilds email lines into paragraphs, bullets and a sign-off block", () => {
    const lines = [
      { text: "Hi,", x: 40, y: 700, height: 10, page: 1 },
      { text: "First line of a paragraph that wraps", x: 40, y: 664, height: 10, page: 1 },
      { text: "onto the next visual line.", x: 40, y: 650, height: 10, page: 1 },
      { text: "● Identify three data sources.", x: 60, y: 618, height: 10, page: 1 },
      { text: "[sub-task (a) = 40%]", x: 300, y: 604, height: 10, page: 1 },
      { text: "Kind regards,", x: 40, y: 572, height: 10, page: 1 },
      { text: "Elizabeth", x: 40, y: 558, height: 10, page: 1 },
    ];
    const html = linesToHtml(lines);
    expect(html).toContain("<p>Hi,</p>");
    // Wrapped lines join into one paragraph; the blank line before the bullet splits blocks.
    expect(html).toContain("<p>First line of a paragraph that wraps onto the next visual line.</p>");
    expect(html).toMatch(/<ul><li>Identify three data sources\.<br>\[sub-task \(a\) = 40%\]<\/li><\/ul>/);
    expect(html).toContain("<p>Kind regards,<br>Elizabeth</p>");
  });
});