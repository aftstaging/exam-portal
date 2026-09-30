import { describe, expect, it } from "vitest";
import { normalizeBasePath, withBasePath } from "@shared/basePath";

/**
 * The portal is served from a path prefix. These tests pin the two rules the whole app relies on:
 * the configured prefix is normalised to a form that both Express (`app.use("/exam", ...)`) and
 * wouter (`base + path`) concatenate correctly, and every root-relative path picks it up exactly
 * once. Getting either wrong sends a login redirect or an API call outside the prefix.
 */
describe("base path", () => {
  describe("normalizeBasePath", () => {
    it("treats an empty, missing or root value as no prefix", () => {
      expect(normalizeBasePath(undefined)).toBe("");
      expect(normalizeBasePath(null)).toBe("");
      expect(normalizeBasePath("")).toBe("");
      expect(normalizeBasePath("   ")).toBe("");
      expect(normalizeBasePath("/")).toBe("");
    });

    it("keeps a prefix with a leading slash and no trailing slash", () => {
      // The trailing slash is dropped because wouter builds URLs as `base + path` and Express
      // treats "/exam" and "/exam/" as different mount paths.
      expect(normalizeBasePath("/exam")).toBe("/exam");
      expect(normalizeBasePath("/exam/")).toBe("/exam");
      expect(normalizeBasePath("exam")).toBe("/exam");
      expect(normalizeBasePath("  /exam/  ")).toBe("/exam");
      expect(normalizeBasePath("/exam///")).toBe("/exam");
    });

    it("supports a nested prefix", () => {
      expect(normalizeBasePath("/portal/exam/")).toBe("/portal/exam");
    });
  });

  describe("withBasePath", () => {
    it("leaves paths untouched when there is no prefix", () => {
      expect(withBasePath("", "/admin")).toBe("/admin");
      expect(withBasePath("", "/api/trpc")).toBe("/api/trpc");
      expect(withBasePath("", "/")).toBe("/");
    });

    it("prefixes root-relative paths", () => {
      expect(withBasePath("/exam", "/admin")).toBe("/exam/admin");
      expect(withBasePath("/exam", "/api/trpc")).toBe("/exam/api/trpc");
      expect(withBasePath("/exam", "/assets/aft_logo_white.png")).toBe("/exam/assets/aft_logo_white.png");
      expect(withBasePath("/portal/exam", "/instructor")).toBe("/portal/exam/instructor");
    });

    it("maps the site root to the bare prefix", () => {
      // A trailing slash here would resolve the built page's relative asset URLs against
      // /exam/ and drop the last path segment.
      expect(withBasePath("/exam", "/")).toBe("/exam");
    });

    it("preserves a query string", () => {
      expect(withBasePath("/exam", "/case-study/debrief?mockExamId=4")).toBe(
        "/exam/case-study/debrief?mockExamId=4"
      );
    });

    it("is idempotent, so double-prefixing cannot happen", () => {
      const once = withBasePath("/exam", "/admin");
      expect(withBasePath("/exam", once)).toBe("/exam/admin");
      expect(withBasePath("/exam", withBasePath("/exam", "/admin"))).toBe("/exam/admin");
    });

    it("leaves absolute and protocol-relative URLs alone", () => {
      expect(withBasePath("/exam", "https://s3.example.com/a.pdf")).toBe("https://s3.example.com/a.pdf");
      expect(withBasePath("/exam", "//cdn.example.com/a.js")).toBe("//cdn.example.com/a.js");
    });

    it("leaves relative paths and fragments alone", () => {
      expect(withBasePath("/exam", "assets/logo.png")).toBe("assets/logo.png");
      expect(withBasePath("/exam", "#section")).toBe("#section");
    });
  });
});
