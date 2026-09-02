import { describe, expect, it } from "vitest";
import { calculateExamExpression } from "./examCalculator";

describe("exam calculator", () => {
  it("evaluates standard arithmetic and respects brackets", () => {
    expect(calculateExamExpression("(120 × 3) − 60 ÷ 2")).toBe("330");
  });

  it("supports percentages and decimal precision", () => {
    expect(calculateExamExpression("12.5% * 800")).toBe("100");
  });

  it("rejects unsupported input and invalid results", () => {
    expect(() => calculateExamExpression("alert(1)")).toThrow();
    expect(() => calculateExamExpression("10 / 0")).toThrow();
  });
});
