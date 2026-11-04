import { describe, expect, it } from "vitest";
import { percentile, share, wilson } from "./stats";

describe("wilson", () => {
  it("gives a real upper bound when nothing went wrong", () => {
    const [low, high] = wilson(0, 32);
    expect(low).toBe(0);
    expect(high).toBeCloseTo(0.1072, 3);
  });

  it("is centred on a half", () => {
    const [low, high] = wilson(16, 32);
    expect(low).toBeCloseTo(0.3363, 3);
    expect(high).toBeCloseTo(0.6637, 3);
  });

  it("stays inside 0 and 1, and says nothing for no data", () => {
    expect(wilson(32, 32)[1]).toBe(1);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
});

describe("percentile", () => {
  it("picks a value that was really measured", () => {
    expect(percentile([5, 1, 4, 2, 3], 50)).toBe(3);
    expect(percentile([5, 1, 4, 2, 3], 95)).toBe(5);
    expect(percentile([], 50)).toBe(0);
  });
});

describe("share", () => {
  it("says the count, the rate and its interval", () => {
    expect(share(0, 32)).toBe("0 of 32 (0%, 95% CI 0–11%)");
    expect(share(16, 32)).toBe("16 of 32 (50%, 95% CI 34–66%)");
    expect(share(0, 2729)).toBe("0 of 2729 (0%, 95% CI 0–0.1%)"); // a small upper bound doesn't round to 0
  });
});
