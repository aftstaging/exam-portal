import { describe, expect, it } from "vitest";
import { containsPattern, escapeLikePattern } from "./search";

describe("escapeLikePattern", () => {
  it("leaves ordinary terms untouched", () => {
    expect(escapeLikePattern("marie")).toBe("marie");
    expect(escapeLikePattern("")).toBe("");
  });

  it("escapes the percent wildcard so it matches a literal percent", () => {
    expect(escapeLikePattern("50%")).toBe("50\\%");
  });

  it("escapes the underscore wildcard so it matches a literal underscore", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("escapes the backslash itself before the wildcards", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("escapes every wildcard in a mixed term", () => {
    expect(escapeLikePattern("50%_off\\now")).toBe("50\\%\\_off\\\\now");
  });
});

describe("containsPattern", () => {
  it("wraps the escaped term in wildcards", () => {
    expect(containsPattern("marie")).toBe("%marie%");
  });

  it("keeps a literal percent literal inside the wrapper", () => {
    expect(containsPattern("50%")).toBe("%50\\%%");
  });

  it("keeps a literal underscore literal inside the wrapper", () => {
    expect(containsPattern("a_b")).toBe("%a\\_b%");
  });
});
