import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/sdk", async () => {
  const actual = await vi.importActual<typeof import("./_core/sdk")>("./_core/sdk");
  return {
    ...actual,
    sdk: {
      ...actual.sdk,
      createSessionToken: vi.fn(async () => "qa-demo-session-token"),
    },
  };
});

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDemoLearnerForQaAccess: vi.fn(async () => ({
      id: 51,
      openId: "aft-demo-learner-60d",
      email: "demo@accountantsfortomorrow.co.za",
      name: "AFT Demo Learner",
      loginMethod: "demo",
      role: "user" as const,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSignedIn: new Date(),
      passwordHash: null,
    })),
    updateUserLastSignedIn: vi.fn(async () => undefined),
    adminGrantEntitlement: vi.fn(async () => undefined as never),
    claimFreeProduct: vi.fn(async () => undefined as never),
    adminGrantEntitlementByProduct: vi.fn(async () => undefined as never),
  };
});

import { appRouter } from "./routers";
import { COOKIE_NAME } from "@shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };

function createQaContext() {
  const setCookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, _value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, options });
      },
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
  return { caller: appRouter.createCaller(ctx), setCookies };
}

describe("QA demo learner session", () => {
  beforeEach(() => {
    process.env.AFT_QA_DEMO_ACCESS = "true";
  });

  it("starts a demo learner session with a session cookie", async () => {
    const { caller, setCookies } = createQaContext();
    const user = await caller.auth.qaDemoLogin();
    expect(user.role).toBe("user");
    expect(user.openId).toBe("aft-demo-learner-60d");
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.options).toMatchObject({ httpOnly: true, path: "/" });
  });

  it("cannot be used to grant or alter entitlements", async () => {
    const db = await import("./db");
    const { caller } = createQaContext();
    await caller.auth.qaDemoLogin();
    expect(db.adminGrantEntitlement).not.toHaveBeenCalled();
    expect(db.claimFreeProduct).not.toHaveBeenCalled();
    expect(db.adminGrantEntitlementByProduct).not.toHaveBeenCalled();
  });
});