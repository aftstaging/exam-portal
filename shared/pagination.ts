export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type PageWindow = Array<number | "gap">;

export type PageSlice<T> = {
  items: T[];
  /** 1-based page actually shown, clamped into range. */
  page: number;
  /** 1-based index of the first row on the page, 0 when there are no rows. */
  startIndex: number;
  /** 1-based index of the last row on the page, 0 when there are no rows. */
  endIndex: number;
  totalItems: number;
  totalPages: number;
};

/**
 * Clamps a 1-based page number into `[1, totalPages]`. A list that shrinks under
 * the current page (a role filter change, a deletion) would otherwise strand the
 * reader on an empty page.
 */
export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), Math.max(1, Math.trunc(totalPages)));
}

/**
 * Slices `items` into a single page and reports the range for "showing X-Y of Z"
 * copy. Out-of-range pages are clamped rather than returning nothing, so the
 * caller always gets the rows a reader would expect to see.
 */
export function paginate<T>(items: T[], page: number, pageSize: number): PageSlice<T> {
  const size = Number.isFinite(pageSize) && Math.trunc(pageSize) > 0 ? Math.trunc(pageSize) : 10;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const current = clampPage(page, totalPages);
  const startIndex = (current - 1) * size;
  const itemsOnPage = items.slice(startIndex, startIndex + size);
  return {
    items: itemsOnPage,
    page: current,
    startIndex: totalItems ? startIndex + 1 : 0,
    endIndex: totalItems ? startIndex + itemsOnPage.length : 0,
    totalItems,
    totalPages,
  };
}

/**
 * Builds the numbered page buttons, collapsing long runs into a single `gap`
 * marker. Always shows the first and last page plus a window around the current
 * one so the ends stay reachable without rendering every button.
 */
export function pageWindow(current: number, totalPages: number, siblings = 1): PageWindow {
  const total = Math.max(1, Math.trunc(totalPages));
  const page = clampPage(current, total);
  const span = Math.max(0, Math.trunc(siblings));
  const windowed = new Set<number>([1, total]);
  for (let offset = -span; offset <= span; offset += 1) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= total) windowed.add(candidate);
  }
  const sorted = Array.from(windowed).sort((a, b) => a - b);
  const result: PageWindow = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous && value - previous > 1) result.push("gap");
    result.push(value);
    previous = value;
  }
  return result;
}

/** Toggles `id` in `selected`, returning a new list. Order is preserved. */
export function toggleSelection(selected: number[], id: number): number[] {
  return selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
}

/**
 * Adds or removes a whole page of rows without selecting anything hidden on
 * other pages, so "select all" always means "everything you can see".
 */
export function selectPage(selected: number[], pageIds: number[], shouldSelect: boolean): number[] {
  const pageIdSet = new Set(pageIds);
  const others = selected.filter((id) => !pageIdSet.has(id));
  return shouldSelect ? [...others, ...pageIds.filter((id) => !others.includes(id))] : others;
}

/**
 * Drops ids the server has confirmed are gone. Only confirmed deletions are dropped:
 * the account table is paged, so pruning against the rows currently drawn would
 * silently discard selections the admin made on other pages.
 */
export function pruneSelection(selected: number[], removedIds: number[]): number[] {
  const removed = new Set(removedIds);
  return selected.filter((id) => !removed.has(id));
}