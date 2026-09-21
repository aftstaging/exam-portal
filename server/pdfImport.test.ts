import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

describe("exams.createFromPdf — import exam papers from a PDF", () => {
  it("rejects learner and anonymous callers with FORBIDDEN", async () => {
    const learner = learnerCaller();
    await expect(learner.exams.createFromPdf(uploadArgs("cartn-mock-3-questions.pdf"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a non-PDF mime type", async () => {
    await expect(staffCaller().exams.createFromPdf({ fileName: "paper.txt", mimeType: "text/plain", base64: "aGVsbG8=" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: /Only PDF files are supported/i });
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
    const sections = draft.caseStudySections ?? [];
    expect(sections).toHaveLength(4);
    sections.forEach((section, index) => {
      expect(section.title).toBe(`Task ${index + 1} — Unseen case material`);
      expect(section.durationSeconds).toBe(2700);
      expect(section.introduction?.length).toBeGreaterThan(100);
    });
  });

  it("extracts the Cartn Mock Exam 4 case study with the expected title and tasks", async () => {
    const draft = await staffCaller().exams.createFromPdf(uploadArgs("cartn-mock-4-questions.pdf"));
    expect(draft.isSolutionsDocument).toBe(false);
    expect(draft.title).toBe("Cartn Mock Exam 4");
    expect(draft.examType).toBe("case_study");
    expect(draft.totalDurationSeconds).toBe(10800);
    expect(draft.caseStudySections).toHaveLength(4);
    expect(draft.reference?.fileName).toBe("cartn-mock-4-questions-reference.pdf");
    expect(draft.formulae?.fileName).toBe("cartn-mock-4-questions-formulae-tables.pdf");
    expect(draft.emailText?.length).toBeGreaterThan(500);
  });

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
  });

  it("treats solutions and marking-guide PDFs as the feedback document without building sections", async () => {
    for (const name of ["cartn-mock-3-solutions.pdf", "cartn-mock-4-solutions.pdf", "cima-mock-b-answers-marking-guide.pdf"]) {
      const draft = await staffCaller().exams.createFromPdf(uploadArgs(name));
      expect(draft.isSolutionsDocument).toBe(true);
      expect(draft.caseStudySections ?? []).toHaveLength(0);
      expect(draft.objectiveQuestions ?? []).toHaveLength(0);
      expect(draft.feedbackFile?.fileName).toBe(name);
      expect(draft.notes).toContain("This file looks like a suggested-solutions / answers / marking-guide document — nothing in it was treated as exam content.");
    }
  });
});