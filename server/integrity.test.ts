import { describe, expect, it } from "vitest";
import { hasActiveEntitlement, isAdminRole, isAttemptEditable, isAttemptSubmittable } from "../shared/integrity";
import { calculateRubricScore, RUBRIC_CRITERIA } from "../shared/rubric";
import { entitlementExpiryFromAccessDays, subscriptionDaysRemaining } from "../shared/payments";

describe("LMS integrity rules", () => {
  it("rejects edits after an attempt is locked or closed", () => {
    expect(isAttemptEditable("in_progress")).toBe(true);
    expect(isAttemptEditable("submitted")).toBe(false);
    expect(isAttemptEditable("marked")).toBe(false);
    expect(isAttemptEditable("cancelled")).toBe(false);
  });

  it("allows submission only from an active attempt", () => {
    expect(isAttemptSubmittable("in_progress")).toBe(true);
    expect(isAttemptSubmittable("awaiting_marking")).toBe(false);
    expect(isAttemptSubmittable("submitted")).toBe(false);
  });

  it("calculates rubric totals across the persisted criteria snapshot", () => {
    expect(RUBRIC_CRITERIA).toHaveLength(4);
    expect(calculateRubricScore([5, 4, 3, 2])).toEqual({ awardedPoints: 14, totalPoints: 20 });
    expect(calculateRubricScore([9, -1, 2.6, 1])).toEqual({ awardedPoints: 9, totalPoints: 20 });
  });

  it("requires active entitlements and administrator role", () => {
    expect(hasActiveEntitlement("active")).toBe(true);
    expect(hasActiveEntitlement("expired")).toBe(false);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("user")).toBe(false);
  });

  it("enforces entitlement start and expiry timestamps", () => {
    const now = new Date("2026-08-27T00:00:00.000Z");
    expect(hasActiveEntitlement({ status: "active", startsAt: "2026-08-26T00:00:00.000Z", expiresAt: "2026-08-28T00:00:00.000Z" }, now)).toBe(true);
    expect(hasActiveEntitlement({ status: "active", startsAt: "2026-08-28T00:00:00.000Z", expiresAt: "2026-09-01T00:00:00.000Z" }, now)).toBe(false);
    expect(hasActiveEntitlement({ status: "active", startsAt: "2026-08-01T00:00:00.000Z", expiresAt: "2026-08-27T00:00:00.000Z" }, now)).toBe(false);
    expect(entitlementExpiryFromAccessDays(30, now).toISOString()).toBe("2026-09-26T00:00:00.000Z");
    expect(subscriptionDaysRemaining("2026-09-09T00:00:00.000Z", now)).toBe(13);
    expect(subscriptionDaysRemaining("2026-08-26T00:00:00.000Z", now)).toBe(0);
  });
});
