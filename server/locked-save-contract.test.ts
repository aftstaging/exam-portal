import { describe, expect, it, vi } from "vitest";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, saveAnswerDraft: vi.fn().mockRejectedValue(new Error("Attempt is not editable")) };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const caller = appRouter.createCaller({
  user: { id: 7, role: "user" } as TrpcContext["user"],
  req: { protocol: "https", get: () => "portal.test" } as never,
  res: { clearCookie: () => undefined } as never,
} satisfies TrpcContext);

describe("locked question save procedure", () => {
  it("surfaces the server lock when a submitted attempt reaches saveAnswer", async () => {
    await expect(caller.exams.saveAnswer({ attemptId: 41, sectionId: 1, body: "draft", wordCount: 1 })).rejects.toThrow("Attempt is not editable");
  });
});
