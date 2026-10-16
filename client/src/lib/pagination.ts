import { useEffect, useState } from "react";

/** Rows per page in every list of the team area. */
export const LIST_PAGE_SIZE = 30;

export type PageInfo = { page: number; pages: number; from: number; to: number; total: number };

/** The slice of `items` on `page` (0-based), with the page clamped to the ones that exist. */
export function pageSlice<T>(items: T[], page: number, size = LIST_PAGE_SIZE): { visible: T[] } & PageInfo {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(0, page), pages - 1);
  const start = current * size;
  const visible = items.slice(start, start + size);
  return { visible, page: current, pages, from: total ? start + 1 : 0, to: start + visible.length, total };
}

/**
 * Pages a list that is already filtered on screen. Goes back to the first page whenever `resetKey`
 * changes (a new search or filter), so nobody lands on an empty page 7.
 */
export function usePagination<T>(items: T[], resetKey: string, size = LIST_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [resetKey]);
  return { ...pageSlice(items, page, size), setPage };
}
