import { describe, expect, it } from "vitest";
import {
  clampPage,
  pageWindow,
  paginate,
  pruneSelection,
  selectPage,
  toggleSelection,
} from "./pagination";

const rows = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

describe("clampPage", () => {
  it("keeps a page inside range", () => {
    expect(clampPage(3, 10)).toBe(3);
  });

  it("pulls a page past the end back to the last one", () => {
    expect(clampPage(99, 10)).toBe(10);
  });

  it("pulls a page below one up to the first", () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(-4, 10)).toBe(1);
  });

  it("treats an empty list as a single page", () => {
    expect(clampPage(5, 0)).toBe(1);
  });
});

describe("paginate", () => {
  it("slices the requested page", () => {
    const page = paginate(rows(25), 2, 10);
    expect(page.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(page.page).toBe(2);
    expect(page.totalItems).toBe(25);
    expect(page.totalPages).toBe(3);
    expect(page.startIndex).toBe(11);
    expect(page.endIndex).toBe(20);
  });

  it("returns a short final page with an accurate range", () => {
    const page = paginate(rows(25), 3, 10);
    expect(page.items).toEqual([21, 22, 23, 24, 25]);
    expect(page.startIndex).toBe(21);
    expect(page.endIndex).toBe(25);
  });

  it("clamps a page left stranded by a shrinking list", () => {
    const page = paginate(rows(4), 9, 10);
    expect(page.page).toBe(1);
    expect(page.items).toEqual([1, 2, 3, 4]);
  });

  it("reports an empty range when there is nothing to show", () => {
    const page = paginate([], 1, 10);
    expect(page.items).toEqual([]);
    expect(page.totalPages).toBe(1);
    expect(page.startIndex).toBe(0);
    expect(page.endIndex).toBe(0);
  });

  it("falls back to a usable page size", () => {
    const page = paginate(rows(12), 1, 0);
    expect(page.items).toHaveLength(10);
    expect(page.totalPages).toBe(2);
  });
});

describe("pageWindow", () => {
  it("lists every page when they all fit", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });

  it("keeps the first and last page reachable", () => {
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
  });

  it("collapses only the far run at the start", () => {
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, "gap", 10]);
  });

  it("collapses only the far run at the end", () => {
    expect(pageWindow(9, 10)).toEqual([1, "gap", 8, 9, 10]);
  });

  it("widens with siblings", () => {
    expect(pageWindow(5, 10, 2)).toEqual([1, "gap", 3, 4, 5, 6, 7, "gap", 10]);
  });

  it("clamps a current page outside the range", () => {
    expect(pageWindow(99, 4)).toEqual([1, "gap", 3, 4]);
    expect(pageWindow(1, 0)).toEqual([1]);
  });
});

describe("toggleSelection", () => {
  it("adds an unselected id", () => {
    expect(toggleSelection([1], 2)).toEqual([1, 2]);
  });

  it("removes a selected id", () => {
    expect(toggleSelection([1, 2], 1)).toEqual([2]);
  });

  it("leaves the original list untouched", () => {
    const selected = [1];
    toggleSelection(selected, 2);
    expect(selected).toEqual([1]);
  });
});

describe("selectPage", () => {
  it("selects every row on the page in page order without duplicates", () => {
    expect(selectPage([], [3, 4], true)).toEqual([3, 4]);
    expect(selectPage([4], [3, 4], true)).toEqual([3, 4]);
  });

  it("keeps selections from other pages", () => {
    expect(selectPage([1, 2], [3, 4], true)).toEqual([1, 2, 3, 4]);
  });

  it("clears only the current page", () => {
    expect(selectPage([1, 2, 3, 4], [3, 4], false)).toEqual([1, 2]);
  });

  it("is a no-op for an empty page", () => {
    expect(selectPage([1, 2], [], false)).toEqual([1, 2]);
  });
});

describe("pruneSelection", () => {
  it("drops the ids that were deleted", () => {
    expect(pruneSelection([1, 2, 3], [2])).toEqual([1, 3]);
  });

  it("keeps ids that were not deleted, including ones off the current page", () => {
    expect(pruneSelection([1, 2, 3], [])).toEqual([1, 2, 3]);
  });

  it("ignores deleted ids that were never selected", () => {
    expect(pruneSelection([1], [7, 8])).toEqual([1]);
  });
});