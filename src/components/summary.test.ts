import { describe, expect, it } from "vitest";
import { firstSentence } from "@/components/summary";
import { STAGE_PREVIEW } from "@/lib/path";

describe("firstSentence", () => {
  it("keeps only the first sentence, and whole texts without a period", () => {
    expect(firstSentence("You look at jobs. Nothing is sent yet.")).toBe("You look at jobs.");
    expect(firstSentence("No period here")).toBe("No period here");
  });

  it("leaves every stage preview a complete sentence", () => {
    for (const text of Object.values(STAGE_PREVIEW)) expect(firstSentence(text)).toMatch(/\.$/);
  });
});
