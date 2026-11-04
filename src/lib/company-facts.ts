// "Get to know the company": what Constela's inclusion data says about a job's company, in Easy Read.
import type { Job } from "@/lib/jobs";

export const SIZE_NAMES = { small: "Small company", medium: "Medium company", large: "Large company" } as const;
const SIZE_PEOPLE = { small: "under 50 people", medium: "50 to 999 people", large: "1,000 people or more" } as const;
const SIZE_SOURCES = {
  bcorp: "from its B Corp data",
  yc: "from Y Combinator's company list",
  posting: "as its own job posting says",
  web: "from a web search",
  estimate: "as an AI estimates",
} as const;

export function companyFacts(job: Job): string[] {
  const f = job.company_facts;
  const facts: string[] = [];
  if (job.company_size) {
    const { size, source } = job.company_size;
    facts.push(`It is a ${SIZE_NAMES[size].toLowerCase()}: ${SIZE_PEOPLE[size]}, ${SIZE_SOURCES[source]}.`);
  }
  const glassdoor = f?.glassdoor_inclusion_mean != null
    ? { mean: f.glassdoor_inclusion_mean, reviews: f.glassdoor_reviews, when: "" }
    : f?.glassdoor_legacy_mean != null
      ? { mean: f.glassdoor_legacy_mean, reviews: f.glassdoor_legacy_reviews, when: " in older reviews" }
      : null;
  if (glassdoor) {
    const count = glassdoor.reviews ? ` (${Math.round(glassdoor.reviews).toLocaleString()} ratings)` : "";
    facts.push(`Employees rated diversity and inclusion ${glassdoor.mean.toFixed(1)} out of 5 on Glassdoor${glassdoor.when}${count}.`);
  }
  if (f?.bcorp_score != null) {
    facts.push(`It is a certified B Corporation (score ${Math.round(f.bcorp_score)}). B Corps are checked on how they treat workers and their community.`);
  }
  if (f?.dei_mx_score != null) {
    facts.push(`Equidad MX 2025 gave it ${Math.round(f.dei_mx_score)} out of 100 for LGBTQ+ inclusion at work.`);
  }
  if (f?.dei_us_2025_match === 1) {
    facts.push("It scored 100 out of 100 in the HRC Corporate Equality Index 2025, a check of LGBTQ+ policies at work.");
  }
  // Internships (backend/collect_internships.py) come only from companies on these lists.
  if (facts.length === (job.company_size ? 1 : 0) && job.tags.includes("inclusion_verified")) {
    facts.push("It is on one of the inclusion lists we use: B Corp, Equidad MX or the HRC Corporate Equality Index.");
  }
  return facts;
}
