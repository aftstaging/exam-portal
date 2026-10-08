import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

import { createRateLimiter } from "./_core/rateLimit";
import { canReadStorageKey } from "./_core/storageAccess";

function dbWithResults(...results: unknown[][]) {
  const query: any = {};
  query.from = vi.fn(() => query);
  query.where = vi.fn(() => query);
  query.limit = vi.fn(() => Promise.resolve(results.shift() ?? []));
  return { select: vi.fn(() => query) };
}

beforeEach(() => getDbMock.mockReset());

describe("createRateLimiter", () => {
  it("blocks a key once its allowance is spent, and only that key", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    limiter.hit("a");
    expect(limiter.isLimited("a")).toBe(false);
    limiter.hit("a");
    expect(limiter.isLimited("a")).toBe(true);
    expect(limiter.isLimited("b")).toBe(false);
  });

  it("clears a key on reset", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.hit("a");
    limiter.reset("a");
    expect(limiter.isLimited("a")).toBe(false);
  });
});

describe("canReadStorageKey", () => {
  it("refuses anonymous access to anything but product images", async () => {
    expect(await canReadStorageKey(null, "product-images/cover.png")).toBe(true);
    expect(await canReadStorageKey(null, "submissions/12/answer.pdf")).toBe(false);
    expect(await canReadStorageKey(null, "avatars/3/photo.png")).toBe(false);
  });

  it("rejects traversal, malformed and unknown keys even for administrators", async () => {
    const admin = { id: 1, role: "admin" };
    expect(await canReadStorageKey(admin, "submissions/../secret")).toBe(false);
    expect(await canReadStorageKey(admin, "submissions//1")).toBe(false);
    expect(await canReadStorageKey(admin, "/etc/passwd")).toBe(false);
    expect(await canReadStorageKey(admin, "unknown-prefix/1")).toBe(false);
  });

  it("does not expose draft resource files to a learner who can access the product", async () => {
    getDbMock.mockResolvedValue(dbWithResults([]));
    expect(await canReadStorageKey({ id: 7, role: "user" }, "admin-resources/3/draft.pdf")).toBe(false);
  });

  it("does not expose draft exam PDFs or question attachments to learners", async () => {
    getDbMock.mockResolvedValueOnce(dbWithResults([{ productId: 3, status: "draft" }]));
    expect(await canReadStorageKey({ id: 7, role: "user" }, "mock-exams/9/printable.pdf")).toBe(false);

    getDbMock.mockResolvedValueOnce(dbWithResults([{ productId: 3, status: "published" }], []));
    expect(await canReadStorageKey({ id: 7, role: "user" }, "objective-attachments/9/draft.png")).toBe(false);
  });

  it("allows a learner to read a published free resource for a published exam", async () => {
    getDbMock.mockResolvedValueOnce(dbWithResults(
      [{ productId: 3, status: "published" }],
      [{ id: 1, status: "published" }],
      [{ priceCents: 0 }],
    ));
    expect(await canReadStorageKey({ id: 7, role: "user" }, "mock-exams/9/printable.pdf")).toBe(true);
  });
});
