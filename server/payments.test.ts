import { describe, expect, it } from "vitest";
import { shouldGrantPurchasedEntitlement } from "../shared/payments";

describe("payment fulfillment policy", () => {
  it("grants access on the first verified purchase", () => {
    expect(shouldGrantPurchasedEntitlement(false)).toBe(true);
  });

  it("does not create duplicate access on repeated delivery", () => {
    expect(shouldGrantPurchasedEntitlement(true)).toBe(false);
  });
});
