import { describe, expect, it } from "vitest";
import { pageSlice } from "./pagination";

const items = Array.from({ length: 65 }, (_, index) => index + 1);

describe("pageSlice", () => {
  it("shows 30 per page and says which rows are on screen", () => {
    expect(pageSlice(items, 0)).toMatchObject({ page: 0, pages: 3, from: 1, to: 30, total: 65 });
    const last = pageSlice(items, 2);
    expect(last.visible).toEqual([61, 62, 63, 64, 65]);
    expect(last).toMatchObject({ from: 61, to: 65 });
  });

  it("never lands past the last page when the list shrinks", () => {
    expect(pageSlice(items.slice(0, 10), 5)).toMatchObject({ page: 0, pages: 1, from: 1, to: 10 });
  });

  it("an empty list is a single empty page", () => {
    expect(pageSlice([], 0)).toMatchObject({ visible: [], page: 0, pages: 1, from: 0, to: 0, total: 0 });
  });
});
