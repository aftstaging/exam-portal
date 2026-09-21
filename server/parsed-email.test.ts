import { describe, expect, it } from "vitest";
import { parseStoredEmail } from "./db";

describe("parseStoredEmail", () => {
  it("parses a composed email stored as JSON in fileUrl", () => {
    const result = parseStoredEmail(JSON.stringify({ from: "board@sopa.co.za", to: "candidate@aft-portal.exam", subject: "Board update", html: "<p>Please review the attached schedule.</p>" }));
    expect(result).toEqual({ from: "board@sopa.co.za", to: "candidate@aft-portal.exam", subject: "Board update", html: "<p>Please review the attached schedule.</p>", mimeType: "text/html" });
  });

  it("returns null for malformed or non-email payloads", () => {
    expect(parseStoredEmail("not-json")).toBeNull();
    expect(parseStoredEmail(JSON.stringify({ from: "", to: "", subject: "", html: "" }))).toBeNull();
    expect(parseStoredEmail("https://bucket.s3.amazonaws.com/email.png")).toBeNull();
  });
});