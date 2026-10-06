import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { DEMO_LEARNER_EMAIL, DEMO_LEARNER_NAME, DEMO_LEARNER_OPEN_ID, isDemoLearnerOpenId } from "@shared/const";

function callerFor(user: TrpcContext["user"], res: TrpcContext["res"] = { clearCookie: () => undefined } as never) {
  const ctx = {
    user,
    req: { protocol: "https", get: () => "portal.test" } as never,
    res,
  } satisfies TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("QA demo access mode", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  beforeEach(() => {
    delete process.env.AFT_QA_DEMO_ACCESS;
    process.env.NODE_ENV = "test";
  });
  afterEach(() => {
    delete process.env.AFT_QA_DEMO_ACCESS;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("reports the demo access flag through qaDemoStatus", async () => {
    expect(await callerFor(null).auth.qaDemoStatus()).toEqual({ enabled: false });
    process.env.AFT_QA_DEMO_ACCESS = "true";
    expect(await callerFor(null).auth.qaDemoStatus()).toEqual({ enabled: true });
  });

  it("keeps QA demo access disabled in production even when the flag is true", async () => {
    process.env.AFT_QA_DEMO_ACCESS = "true";
    process.env.NODE_ENV = "production";
    expect(await callerFor(null).auth.qaDemoStatus()).toEqual({ enabled: false });
    await expect(callerFor(null).auth.qaDemoLogin()).rejects.toThrow("QA demo access is disabled");
  });

  it("keeps QA demo access disabled outside development and test", async () => {
    process.env.AFT_QA_DEMO_ACCESS = "true";
    process.env.NODE_ENV = "staging";
    expect(await callerFor(null).auth.qaDemoStatus()).toEqual({ enabled: false });
  });

  it("fails closed when the QA demo access flag is disabled", async () => {
    await expect(callerFor(null).auth.qaDemoLogin()).rejects.toThrow("QA demo access is disabled");
  });

  it("only ever treats the isolated demo learner openId as a demo account", () => {
    expect(isDemoLearnerOpenId(DEMO_LEARNER_OPEN_ID)).toBe(true);
    expect(isDemoLearnerOpenId("local:someone-else")).toBe(false);
    expect(isDemoLearnerOpenId(null)).toBe(false);
    expect(isDemoLearnerOpenId(undefined)).toBe(false);
  });

  it("uses the isolated demo learner identity constants", () => {
    expect(DEMO_LEARNER_EMAIL).toBe("demo@accountantsfortomorrow.co.za");
    expect(DEMO_LEARNER_NAME).toBe("AFT Demo Learner");
    expect(DEMO_LEARNER_OPEN_ID).toBe("aft-demo-learner-60d");
  });
});