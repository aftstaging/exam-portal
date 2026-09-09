import { describe, expect, it } from "vitest";
import { getAttemptRoute, getDashboardSelection, getDashboardSelectionState, getDashboardView, getExamRetakeRoute, getProductRoute } from "../shared/dashboard";

describe("dashboard navigation helpers", () => {
  it("maps each dashboard tab to a distinct view", () => {
    expect(getDashboardView("Overview")).toBe("summary");
    expect(getDashboardView("My products")).toBe("products");
    expect(getDashboardView("Saved attempts")).toBe("attempts");
    expect(getDashboardView("Results")).toBe("results");
  });

  it("routes attempts to their record preview instead of resuming an exam", () => {
    expect(getAttemptRoute(41, "in_progress")).toBe("/dashboard?attempt=41");
    expect(getAttemptRoute(41, "marked")).toBe("/dashboard?attempt=41");
  });

  it("keeps product identity when no active attempt exists", () => {
    expect(getProductRoute(9)).toBe("/dashboard?product=9");
    expect(getProductRoute(9, 41, "in_progress")).toBe("/dashboard?attempt=41");
  });

  it("routes case-study products into a fresh retake even when an attempt is in progress", () => {
    expect(getProductRoute(9, undefined, undefined, "case_study", 44)).toBe("/case-study/debrief?mockExamId=44&productId=9");
    expect(getProductRoute(9, 41, "in_progress", "case_study", 44)).toBe("/case-study/debrief?mockExamId=44&productId=9");
    expect(getExamRetakeRoute(44, 9)).toBe("/case-study/debrief?mockExamId=44&productId=9");
  });

  it("routes objective products into the objective-test experience", () => {
    expect(getProductRoute(30001, undefined, undefined, "objective_test")).toBe("/objective-tests?productId=30001");
    expect(getProductRoute(9, 41, "in_progress", "case_study")).toBe("/dashboard?attempt=41");
  });

  it("resolves dashboard deep-link parameters to exact record ids", () => {
    expect(getDashboardSelection("?attempt=41")).toEqual({ attemptId: 41, productId: undefined });
    expect(getDashboardSelection("?product=9")).toEqual({ attemptId: undefined, productId: 9 });
    expect(getDashboardSelection("?attempt=bad&product=0")).toEqual({ attemptId: undefined, productId: undefined });
  });

  it("selects the correct dashboard view for each deep link", () => {
    expect(getDashboardSelectionState(getDashboardSelection("?attempt=41"))).toEqual({ tab: "Saved attempts", attemptId: 41 });
    expect(getDashboardSelectionState(getDashboardSelection("?product=9"))).toEqual({ tab: "My products", productId: 9 });
    expect(getDashboardSelectionState(getDashboardSelection(""))).toEqual({ tab: "Overview" });
  });
});
