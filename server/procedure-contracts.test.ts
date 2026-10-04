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

  it("rejects non-admin supervision management and anonymous learner lists", async () => {
    const staff = { id: 7, role: "instructor" } as TrpcContext["user"];
    const staffCaller = callerFor(staff);
    await expect(staffCaller.supervision.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staffCaller.supervision.assign({ studentId: 1, instructorId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staffCaller.supervision.end({ supervisionId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(null).supervision.myLearners()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("guards the account table and its bulk removal behind the admin role", async () => {
    const learner = { id: 7, role: "user" } as TrpcContext["user"];
    const instructor = { id: 7, role: "instructor" } as TrpcContext["user"];
    await expect(callerFor(learner).admin.userPage({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(instructor).admin.userPage({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(learner).admin.removeUsers({ userIds: [1] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects out-of-range paging and empty bulk selections before database work", async () => {
    const admin = { id: 1, role: "admin" } as TrpcContext["user"];
    const caller = callerFor(admin);
    await expect(caller.admin.userPage({ page: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.admin.userPage({ pageSize: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.admin.userPage({ pageSize: 5000 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.admin.removeUsers({ userIds: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
