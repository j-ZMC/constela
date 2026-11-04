import { describe, expect, it } from "vitest";
import { companyFacts } from "@/lib/company-facts";
import type { Job } from "@/lib/jobs";

const none = {
  glassdoor_inclusion_mean: null,
  glassdoor_reviews: null,
  glassdoor_legacy_mean: null,
  glassdoor_legacy_reviews: null,
  bcorp_score: null,
  dei_mx_score: null,
  dei_us_2025_match: null,
};
const job = (company_facts: Job["company_facts"], tags: string[] = []) => ({ company_facts, tags }) as Job;

describe("companyFacts", () => {
  it("says what each inclusion source found", () => {
    const facts = companyFacts(job({ ...none, glassdoor_inclusion_mean: 4.04, glassdoor_reviews: 1234, bcorp_score: 95.6, dei_us_2025_match: 1 }));
    expect(facts).toHaveLength(3);
    expect(facts[0]).toMatch(/4\.0 out of 5 on Glassdoor \(1,234 ratings\)/);
    expect(facts[1]).toMatch(/B Corporation \(score 96\)/);
    expect(facts[2]).toMatch(/HRC/);
  });

  it("falls back to older Glassdoor reviews", () => {
    expect(companyFacts(job({ ...none, glassdoor_legacy_mean: 3.9 }))[0]).toMatch(/3\.9 out of 5 on Glassdoor in older reviews\./);
  });

  it("names the lists for internships, and says nothing it does not know", () => {
    expect(companyFacts(job(undefined, ["internship", "inclusion_verified"]))[0]).toMatch(/inclusion lists/);
    expect(companyFacts(job(null))).toEqual([]);
  });
});
