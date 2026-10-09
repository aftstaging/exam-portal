import { describe, expect, it } from "vitest";
import {
  matchesImageSignature,
  isValidDateOfBirth,
  isValidHttpsUrl,
  isValidPhone,
  normalizeProfileInput,
  scorePercent,
  submissionStatusLabel,
  summarizePerformance,
} from "./performance";

describe("scorePercent", () => {
  it("rounds to one decimal and clamps negative awards", () => {
    expect(scorePercent(37, 60)).toBe(61.7);
    expect(scorePercent(-4, 60)).toBe(0);
  });
  it("returns null when nothing is markable", () => {
    expect(scorePercent(0, 0)).toBeNull();
  });
});

describe("summarizePerformance", () => {
  it("computes averages, pass rate and a chronological trend", () => {
    const summary = summarizePerformance([
      { submitted: true, awaitingMarking: false, percent: 40, date: "2026-03-02T10:00:00Z" },
      { submitted: true, awaitingMarking: false, percent: 70, date: "2026-01-02T10:00:00Z" },
      { submitted: true, awaitingMarking: true, percent: null, date: "2026-04-02T10:00:00Z" },
    ]);
    expect(summary.submitted).toBe(3);
    expect(summary.marked).toBe(2);
    expect(summary.awaitingMarking).toBe(1);
    expect(summary.averagePercent).toBe(55);
    expect(summary.bestPercent).toBe(70);
    expect(summary.latestPercent).toBe(40);
    expect(summary.passRate).toBe(50);
    expect(summary.trend.map((point) => point.percent)).toEqual([70, 40]);
  });
  it("handles a learner with no marked work", () => {
    const summary = summarizePerformance([]);
    expect(summary.averagePercent).toBeNull();
    expect(summary.passRate).toBeNull();
    expect(summary.trend).toEqual([]);
  });
});

describe("submissionStatusLabel", () => {
  it("describes each stage of a submission", () => {
    expect(submissionStatusLabel("in_progress", null, false)).toBe("In progress");
    expect(submissionStatusLabel("awaiting_marking", "unassigned", false)).toBe("Awaiting marking");
    expect(submissionStatusLabel("awaiting_marking", "in_progress", false)).toBe("Being marked");
    expect(submissionStatusLabel("marked", "submitted", false)).toBe("Marked");
  });
  it("keeps opted-out submissions in the live marking pipeline", () => {
    expect(submissionStatusLabel("submitted", null, true)).toBe("Awaiting marking");
    expect(submissionStatusLabel("submitted", "unassigned", true)).toBe("Awaiting marking");
  });
});

describe("profile validation", () => {
  it("blanks become null and names are trimmed", () => {
    const normalized = normalizeProfileInput({ name: "  Ada  ", bio: "   ", phone: " +27 82 555 1234 " });
    expect(normalized.name).toBe("Ada");
    expect(normalized.bio).toBeNull();
    expect(normalized.phone).toBe("+27 82 555 1234");
  });
  it("accepts reasonable phone numbers only", () => {
    expect(isValidPhone("+27 82 555 1234")).toBe(true);
    expect(isValidPhone("(021) 555-1234")).toBe(true);
    expect(isValidPhone("call me")).toBe(false);
    expect(isValidPhone(null)).toBe(true);
  });
  it("requires an https LinkedIn URL and a past date of birth", () => {
    expect(isValidHttpsUrl("https://linkedin.com/in/ada")).toBe(true);
    expect(isValidHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isValidDateOfBirth("1990-02-30")).toBe(false);
    expect(isValidDateOfBirth("1990-02-01")).toBe(true);
    expect(isValidDateOfBirth("2999-01-01")).toBe(false);
  });
  it("checks image bytes against the declared type", () => {
    expect(matchesImageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]), "image/png")).toBe(true);
    expect(matchesImageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/jpeg")).toBe(false);
  });
});
