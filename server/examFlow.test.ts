import { describe, expect, it } from "vitest";
import { canStartExamBeforeCooldown, shouldAutoStartExam } from "../shared/examFlow";
import { isAttemptEditable } from "../shared/integrity";
import { getAttemptRoute } from "../shared/dashboard";

describe("case-study exam flow", () => {
  it("allows manual start during the cooldown and auto-starts at zero", () => {
    expect(canStartExamBeforeCooldown(30)).toBe(true);
    expect(canStartExamBeforeCooldown(1)).toBe(true);
    expect(shouldAutoStartExam(0)).toBe(true);
    expect(shouldAutoStartExam(-1)).toBe(true);
  });

  it("keeps submitted attempts non-editable and out of resumable question routes", () => {
    expect(isAttemptEditable("in_progress")).toBe(true);
    expect(isAttemptEditable("submitted")).toBe(false);
    expect(isAttemptEditable("awaiting_marking")).toBe(false);
    expect(isAttemptEditable("marked")).toBe(false);
    expect(getAttemptRoute(41, "submitted")).toBe("/dashboard?attempt=41");
    expect(getAttemptRoute(41, "awaiting_marking")).toBe("/dashboard?attempt=41");
  });
});
