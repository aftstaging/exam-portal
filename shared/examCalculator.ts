export function calculateExamExpression(expression: string) {
  if (!expression.trim() || !/^[0-9+\-*/().% ×÷−]+$/.test(expression)) {
    throw new Error("Use numbers and +, −, ×, ÷, %, and brackets only.");
  }
  const normalized = expression.replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
  const result = Function(`"use strict"; return (${normalized})`)();
  if (typeof result !== "number" || !Number.isFinite(result)) throw new Error("That calculation is not valid.");
  return String(Math.round((result + Number.EPSILON) * 1e10) / 1e10);
}
