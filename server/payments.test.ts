import { describe, expect, it } from "vitest";
import { couponExpiryFromInput, shouldGrantPurchasedEntitlement } from "../shared/payments";

describe("payment fulfillment policy", () => {
  it("grants access on the first verified purchase", () => {
    expect(shouldGrantPurchasedEntitlement(false)).toBe(true);
  });

  it("does not create duplicate access on repeated delivery", () => {
    expect(shouldGrantPurchasedEntitlement(true)).toBe(false);
  });
});

describe("coupon expiry parsing", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  it("treats blank input as never expiring", () => {
    expect(couponExpiryFromInput(undefined, now)).toBeNull();
    expect(couponExpiryFromInput(null, now)).toBeNull();
    expect(couponExpiryFromInput("   ", now)).toBeNull();
  });
  it("keeps a bare date valid through the end of that day", () => {
    const expiry = couponExpiryFromInput("2027-01-31", now)!;
    expect(expiry.toISOString()).toBe("2027-01-31T23:59:59.999Z");
  });
  it("accepts an explicit future date-time as given", () => {
    const expiry = couponExpiryFromInput("2027-06-15T12:34:56.000Z", now)!;
    expect(expiry.toISOString()).toBe("2027-06-15T12:34:56.000Z");
  });
  it("rejects past expiries and unparseable input", () => {
    expect(() => couponExpiryFromInput("2026-01-01", now)).toThrow(/future/i);
    expect(() => couponExpiryFromInput("not-a-date", now)).toThrow(/valid date/i);
  });
});
