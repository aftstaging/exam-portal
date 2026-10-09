/**
 * Exam calculator engine.
 *
 * A small, safe arithmetic parser for the on-screen exam calculator. It deliberately does not use
 * `eval`/`Function`: only numbers, +, −, ×, ÷, % and brackets are understood, everything else is
 * rejected with a friendly message. Percent follows normal calculator behaviour — `50 + 10%` is
 * `55` (10% of 50 added on), while a standalone `12.5%` is `0.125` so `12.5% × 800` is `100`.
 */

const ALLOWED_CHARACTERS = /^[0-9+\-*/().% ×÷−]+$/;

type Token =
  | { kind: "number"; value: number }
  | { kind: "operator"; value: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "percent" };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index]!;
    if (char === " ") {
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ kind: "lparen" });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ kind: "rparen" });
      index += 1;
      continue;
    }
    if (char === "%") {
      tokens.push({ kind: "percent" });
      index += 1;
      continue;
    }
    if (char === "+" || char === "-" || char === "−" || char === "*" || char === "×" || char === "/" || char === "÷") {
      const value = char === "−" ? "-" : char === "×" ? "*" : char === "÷" ? "/" : char;
      tokens.push({ kind: "operator", value: value as "+" | "-" | "*" | "/" });
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let raw = "";
      while (index < expression.length && /[0-9.]/.test(expression[index]!)) {
        raw += expression[index];
        index += 1;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error("That calculation is not valid.");
      tokens.push({ kind: "number", value });
      continue;
    }
    throw new Error("Use numbers and +, −, ×, ÷, %, and brackets only.");
  }
  return tokens;
}

/** A parsed value plus whether it is a bare percentage (`50%`) that a +/− base can apply to. */
type ParsedValue = { value: number; percent: boolean };

class ExpressionParser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ParsedValue {
    const result = this.parseAdditive();
    if (this.position < this.tokens.length) throw new Error("That calculation is not valid.");
    return result;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private parseAdditive(): ParsedValue {
    let left = this.parseMultiplicative();
    while (this.peek()?.kind === "operator") {
      const operator = (this.peek() as { value: string }).value;
      if (operator !== "+" && operator !== "-") break;
      this.position += 1;
      const right = this.parseMultiplicative();
      // Standard calculator percent: `50 + 10%` is `55` and `200 − 25%` is `150`
      // (the percentage is taken of the running total), while a bare `12.5%` is `0.125`.
      if (right.percent) {
        left = { value: operator === "+" ? left.value * (1 + right.value) : left.value * (1 - right.value), percent: false };
      } else {
        left = { value: operator === "+" ? left.value + right.value : left.value - right.value, percent: false };
      }
    }
    return left;
  }

  private parseMultiplicative(): ParsedValue {
    let left = this.parseUnary();
    while (this.peek()?.kind === "operator") {
      const operator = (this.peek() as { value: "*" | "/" }).value;
      if (operator !== "*" && operator !== "/") break;
      this.position += 1;
      const right = this.parseUnary();
      if (operator === "*") {
        left = { value: left.value * right.value, percent: false };
      } else {
        if (right.value === 0) throw new Error("Cannot divide by zero.");
        left = { value: left.value / right.value, percent: false };
      }
    }
    return left;
  }

  private parseUnary(): ParsedValue {
    const token = this.peek();
    if (token?.kind === "operator" && (token.value === "-" || token.value === "+")) {
      this.position += 1;
      const operand = this.parseUnary();
      return { value: token.value === "-" ? -operand.value : operand.value, percent: operand.percent };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): ParsedValue {
    let value = this.parsePrimary();
    while (this.peek()?.kind === "percent") {
      this.position += 1;
      value = { value: value.value / 100, percent: true };
    }
    return value;
  }

  private parsePrimary(): ParsedValue {
    const token = this.peek();
    if (!token) throw new Error("That calculation is not valid.");
    if (token.kind === "number") {
      this.position += 1;
      return { value: token.value, percent: false };
    }
    if (token.kind === "lparen") {
      this.position += 1;
      const inner = this.parseAdditive();
      if (this.peek()?.kind !== "rparen") throw new Error("That calculation is not valid.");
      this.position += 1;
      return { value: inner.value, percent: false };
    }
    throw new Error("That calculation is not valid.");
  }
}

export function calculateExamExpression(expression: string) {
  const trimmed = expression.trim();
  if (!trimmed) throw new Error("Enter a calculation first.");
  if (!ALLOWED_CHARACTERS.test(trimmed)) {
    throw new Error("Use numbers and +, −, ×, ÷, %, and brackets only.");
  }
  const tokens = tokenize(trimmed);
  if (!tokens.length) throw new Error("Enter a calculation first.");
  const result = new ExpressionParser(tokens).parse();
  if (!Number.isFinite(result.value)) throw new Error("That calculation is not valid.");
  return String(Math.round((result.value + Number.EPSILON) * 1e10) / 1e10);
}
