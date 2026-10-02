import { describe, expect, it } from "vitest";
import { countActiveEntitlements, isEnrolled, isSupervisionActive } from "../shared/supervision";

describe("supervision rules", () => {
  const now = new Date("2026-09-01T00:00:00.000Z");

  it("counts only currently active entitlements", () => {
    expect(
      countActiveEntitlements(
        [
          { status: "active", startsAt: "2026-08-01T00:00:00.000Z", expiresAt: "2026-09-15T00:00:00.000Z" },
          { status: "active", startsAt: "2026-09-10T00:00:00.000Z" },
          { status: "active", startsAt: "2026-08-01T00:00:00.000Z", expiresAt: "2026-08-30T00:00:00.000Z" },
          { status: "revoked" },
          { status: "expired" },
        ],
        now,
      ),
    ).toBe(1);
  });

  it("treats a learner with no live entitlement as not enrolled", () => {
    expect(isEnrolled([], now)).toBe(false);
    expect(isEnrolled([{ status: "expired" }], now)).toBe(false);
    expect(isEnrolled([{ status: "active" }], now)).toBe(true);
  });

  it("only an active supervision row is live", () => {
    expect(isSupervisionActive("active")).toBe(true);
    expect(isSupervisionActive("ended")).toBe(false);
    expect(isSupervisionActive(undefined)).toBe(false);
  });
});
