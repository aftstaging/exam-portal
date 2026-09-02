import { describe, expect, it } from "vitest";
import { buildPayFastCheckout, createPayFastHostedCheckout, createPayFastSignature, payFastEndpoint, payFastIsConfigured, verifyPayFastITN } from "./payfast";

describe("PayFast integration", () => {
  it("generates a deterministic MD5 signature from sorted fields", () => {
    const fields = { merchant_id: "10000100", merchant_key: "46f0cd694581a", amount: "100.00", item_name: "Test" };
    const signature = createPayFastSignature(fields);
    expect(signature).toHaveLength(32);
    expect(createPayFastSignature(fields)).toBe(signature);
  });

  it("uses the sandbox endpoint by default and fails closed when credentials are blank", () => {
    expect(payFastEndpoint("sandbox")).toBe("https://sandbox.payfast.co.za/eng/process");
    expect(payFastEndpoint("live")).toBe("https://www.payfast.co.za/eng/process");
    expect(payFastIsConfigured("sandbox")).toBe(false);
    expect(verifyPayFastITN({ merchant_id: "10000100", amount: "100.00", signature: "invalid" }, "sandbox")).toBe(false);
    expect(buildPayFastCheckout({ amount: "100.00", item_name: "Mock" }, "sandbox")).toBeNull();
    expect(createPayFastHostedCheckout({ productId: 1, userId: 1, origin: "https://example.test", mode: "sandbox", amount: "100.00", itemName: "Mock" })).toBeNull();
  });
});
