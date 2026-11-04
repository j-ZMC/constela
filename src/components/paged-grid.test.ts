import { describe, expect, it } from "vitest";
import { pageCount, pageNumbers, pageOf } from "@/components/paged-grid";

describe("pages", () => {
  it("shows the first, the last and the pages around the current one", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(2, 4)).toEqual([1, 2, 3, 4]);
    expect(pageNumbers(5, 9)).toEqual([1, "…", 4, 5, 6, "…", 9]);
    expect(pageNumbers(1, 9)).toEqual([1, 2, "…", 9]);
  });

  it("cuts a list into pages", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(pageCount(items.length, 12)).toBe(3);
    expect(pageCount(0, 12)).toBe(1);
    expect(pageOf(items, 3, 12)).toEqual([24]);
  });
});
