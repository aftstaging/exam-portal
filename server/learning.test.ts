import { describe, expect, it } from "vitest";
import { getAttemptProgress, humanizeStatus } from "../shared/learning";

describe("learner progress helpers", () => {
  it("maps active sections to bounded progress", () => {
    expect(getAttemptProgress("in_progress", 1)).toBe(25);
    expect(getAttemptProgress("in_progress", 8)).toBe(99);
  });

  it("marks submitted states complete and untouched states empty", () => {
    expect(getAttemptProgress("awaiting_marking", 2)).toBe(100);
    expect(getAttemptProgress("marked", 2)).toBe(100);
    expect(getAttemptProgress("not_started", 1)).toBe(0);
  });

  it("humanizes persisted status values", () => {
    expect(humanizeStatus("awaiting_marking")).toBe("awaiting marking");
  });
});
