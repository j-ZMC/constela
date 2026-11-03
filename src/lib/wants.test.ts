import { describe, expect, it } from "vitest";
import { cleanWants, toggleWant } from "@/lib/wants";

describe("wants", () => {
  it("adds up to 3, then refuses a fourth", () => {
    expect(toggleWant(["remote", "pay"], "quiet")).toEqual(["remote", "pay", "quiet"]);
    expect(toggleWant(["remote", "pay", "quiet"], "learn")).toEqual(["remote", "pay", "quiet"]);
  });

  it("removes a chosen one", () => {
    expect(toggleWant(["remote", "pay"], "remote")).toEqual(["pay"]);
  });

  it("keeps only known, unique ids from storage", () => {
    expect(cleanWants(["remote", "remote", "nope", 4, "pay", "quiet", "learn"])).toEqual(["remote", "pay", "quiet"]);
    expect(cleanWants("remote")).toEqual([]);
  });
});
