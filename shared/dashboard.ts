export type DashboardTab = "Overview" | "My products" | "Saved attempts" | "Results";
export type DashboardView = "summary" | "products" | "attempts" | "results";

export function getDashboardView(tab: DashboardTab): DashboardView {
  if (tab === "My products") return "products";
  if (tab === "Saved attempts") return "attempts";
  if (tab === "Results") return "results";
  return "summary";
}

export function getAttemptRoute(attemptId: number, status: string): string {
  return `/dashboard?attempt=${attemptId}`;
}

export function getExamRetakeRoute(mockExamId: number, productId: number): string {
  return `/case-study/debrief?mockExamId=${mockExamId}&productId=${productId}`;
}

export function getProductRoute(productId: number, attemptId?: number, status?: string, category?: string, mockExamId?: number): string {
  if (category === "objective_test") return `/objective-tests?productId=${productId}`;
  if (category === "case_study" && mockExamId) return getExamRetakeRoute(mockExamId, productId);
  if (attemptId && status === "in_progress") return getAttemptRoute(attemptId, status);
  return `/dashboard?product=${productId}`;
}

export function getDashboardSelection(search: string): { attemptId?: number; productId?: number } {
  const params = new URLSearchParams(search);
  const attempt = Number(params.get("attempt"));
  const product = Number(params.get("product"));
  return {
    attemptId: Number.isInteger(attempt) && attempt > 0 ? attempt : undefined,
    productId: Number.isInteger(product) && product > 0 ? product : undefined,
  };
}

export function getDashboardSelectionState(selection: { attemptId?: number; productId?: number }): { tab: DashboardTab; attemptId?: number; productId?: number } {
  if (selection.attemptId) return { tab: "Saved attempts", attemptId: selection.attemptId };
  if (selection.productId) return { tab: "My products", productId: selection.productId };
  return { tab: "Overview" };
}
