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

/** URL slugs for the dashboard sections, so other pages can link straight to one. */
export const DASHBOARD_TAB_SLUGS: Record<string, DashboardTab> = {
  overview: "Overview",
  products: "My products",
  attempts: "Saved attempts",
  results: "Results",
};

/** The dashboard section a URL asks for, e.g. `?tab=results`, or undefined when none is asked for. */
export function dashboardTabForSlug(slug: string | null): DashboardTab | undefined {
  return slug ? DASHBOARD_TAB_SLUGS[slug.toLowerCase()] : undefined;
}

export function getDashboardSelection(search: string): { attemptId?: number; productId?: number; tab?: DashboardTab } {
  const params = new URLSearchParams(search);
  const attempt = Number(params.get("attempt"));
  const product = Number(params.get("product"));
  const tab = dashboardTabForSlug(params.get("tab"));
  return {
    attemptId: Number.isInteger(attempt) && attempt > 0 ? attempt : undefined,
    productId: Number.isInteger(product) && product > 0 ? product : undefined,
    ...(tab ? { tab } : {}),
  };
}

export function getDashboardSelectionState(selection: { attemptId?: number; productId?: number; tab?: DashboardTab }): { tab: DashboardTab; attemptId?: number; productId?: number } {
  if (selection.attemptId) return { tab: "Saved attempts", attemptId: selection.attemptId };
  if (selection.productId) return { tab: "My products", productId: selection.productId };
  return { tab: selection.tab ?? "Overview" };
}
