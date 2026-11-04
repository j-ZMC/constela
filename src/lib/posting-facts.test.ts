import { describe, expect, it } from "vitest";
import facts from "@/lib/posting-facts.json";
import { inHundred, inTen, postingFactsLine } from "@/lib/posting-facts";

describe("postingFactsLine", () => {
  it("says the measured facts in whole numbers", () => {
    expect(postingFactsLine({ postings: 2729, vague: 0.32, answerTime: 0.034, clearAtBest: 0.007 })).toBe(
      "We read 2,729 real job posts: 3 in 10 use a vague phrase, and 3 in 100 say when they will answer.",
    );
  });

  it("says none rather than 0 in 100", () => {
    expect(postingFactsLine({ postings: 2729, vague: 0.32, answerTime: 0, clearAtBest: 0 })).toContain("and none says when they will answer.");
  });

  it("reads the numbers the last run of npm run eval:postings wrote", () => {
    expect(facts.postings).toBeGreaterThan(1000);
    expect(postingFactsLine()).toContain(facts.postings.toLocaleString("en-US"));
  });
});

describe("whole numbers", () => {
  it("says a share in tens and hundreds", () => {
    expect([inTen(0.62), inHundred(0.034), inHundred(0.004), inHundred(0)]).toEqual(["6 in 10", "3 in 100", "fewer than 1 in 100", "0 in 100"]);
  });
});
