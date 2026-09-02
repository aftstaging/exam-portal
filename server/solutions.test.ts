import { describe, expect, it } from "vitest";
import { canViewIllustrativeSolutions, getIllustrativeSolutions, solutionAccessLabel } from "@shared/solutions";

describe("illustrative solution access", () => {
  it("keeps solutions locked while an attempt is in progress", () => {
    expect(canViewIllustrativeSolutions("in_progress")).toBe(false);
    expect(solutionAccessLabel("in_progress")).toBe("Solutions unlock after submission");
  });

  it("unlocks solutions for submitted, awaiting-marking, and marked attempts", () => {
    expect(canViewIllustrativeSolutions("submitted")).toBe(true);
    expect(canViewIllustrativeSolutions("awaiting_marking")).toBe(true);
    expect(canViewIllustrativeSolutions("marked")).toBe(true);
    expect(solutionAccessLabel("marked")).toBe("Illustrative guide unlocked");
  });

  it("does not unlock solutions without a learner attempt", () => {
    expect(canViewIllustrativeSolutions(undefined)).toBe(false);
    expect(canViewIllustrativeSolutions("cancelled")).toBe(false);
    expect(solutionAccessLabel(undefined)).toBe("Complete an interactive attempt to unlock solutions");
  });

  it("sources distinct content for each imported exam", () => {
    const sections = [
      { sectionNumber: 1, title: "Task 1 — Risks and negotiations", introduction: "Risk and negotiation brief" },
      { sectionNumber: 2, title: "Task 2 — Disruptive technology", introduction: "Technology brief" },
    ];
    const cartn = getIllustrativeSolutions("Cartn Mock Exam 3", sections);
    const other = getIllustrativeSolutions("Cartn Mock Exam 4", sections);
    expect(cartn[0]?.heading).toContain("Risks and negotiation");
    expect(cartn[0]?.body).toContain("risk");
    expect(other[0]?.heading).toContain("Digital data sources");
    expect(other[0]?.body).not.toBe(cartn[0]?.body);
  });
});
