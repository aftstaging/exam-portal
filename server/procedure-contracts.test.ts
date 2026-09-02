import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function callerFor(user: TrpcContext["user"]) {
  const ctx = {
    user,
    req: { protocol: "https", get: () => "portal.test" } as never,
    res: { clearCookie: () => undefined } as never,
  } satisfies TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("protected tRPC procedure contracts", () => {
  it("rejects anonymous access to learner notifications", async () => {
    await expect(callerFor(null).student.notifications()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects non-admin access to the admin overview", async () => {
    const user = { id: 7, role: "user" } as TrpcContext["user"];
    await expect(callerFor(user).admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects non-admin demo-account provisioning", async () => {
    const user = { id: 7, role: "user" } as TrpcContext["user"];
    await expect(callerFor(user).admin.provisionDemoLearner()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects malformed autosave and protected-download inputs before database work", async () => {
    const user = { id: 7, role: "user" } as TrpcContext["user"];
    const caller = callerFor(user);
    await expect(caller.exams.saveAnswer({ attemptId: 0, sectionId: 1, body: "", wordCount: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.resources.download({ resourceId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
