import { describe, expect, it } from "vitest";
import { calculateExamExpression } from "./examCalculator";

describe("exam calculator", () => {
  it("evaluates standard arithmetic and respects brackets", () => {
    expect(calculateExamExpression("(120 × 3) − 60 ÷ 2")).toBe("330");
    expect(calculateExamExpression("1 + 2 × 3")).toBe("7");
    expect(calculateExamExpression("10 - 3 - 2")).toBe("5");
    expect(calculateExamExpression("-(4) + 10")).toBe("6");
  });

  it("supports percentages and decimal precision", () => {
    expect(calculateExamExpression("12.5% * 800")).toBe("100");
    expect(calculateExamExpression("50 + 10%")).toBe("55");
    expect(calculateExamExpression("200 − 25%")).toBe("150");
    expect(calculateExamExpression("50%")).toBe("0.5");
    expect(calculateExamExpression("0.1 + 0.2")).toBe("0.3");
    expect(calculateExamExpression("(2 + 3)%")).toBe("0.05");
  });

  it("rejects unsupported input and invalid results", () => {
    expect(() => calculateExamExpression("alert(1)")).toThrow();
    expect(() => calculateExamExpression("10 / 0")).toThrow(/divide by zero/i);
    expect(() => calculateExamExpression("")).toThrow();
    expect(() => calculateExamExpression("2.5.3")).toThrow();
    expect(() => calculateExamExpression("(2 + 3")).toThrow();
    expect(() => calculateExamExpression("2 +")).toThrow();
  });
});
