import { describe, expect, it, vi } from "vitest";
import { parseJobSearchRequest, parseJobSearchResponse, parseWorkerResult, searchJobs } from "@/lib/jobs";

const job = {
  title: "Remote analyst",
  company: "Example Co",
  location: "Worldwide",
  modality: "remote",
  modality_classification: "remote",
  salary_min: null,
  salary_max: null,
  currency: "",
  description: "Review data and prepare reports.",
  url: "https://example.com/job",
  date: "2026-10-01",
  source: "example",
  tags: ["analysis"],
  similarity: 0.82,
  similarity_rank: 1,
  blocked: false,
  block_reasons: [],
  company_verified: true,
  company_verification_status: "qualified",
};

const summary = {
  query: "remote analyst",
  selected_blockers: [],
  input_jobs: 100,
  jobs_excluded_by_company: 2,
  companies_excluded: 1,
  jobs_scored: 98,
  similarity_matches: 4,
  requested_modalities: ["remote"],
  modality_filter_applied: true,
  modality_excluded_matches: 8,
  blocked_similarity_matches: 1,
  visible_matches: 3,
  verified_company_matches: 2,
  average_similarity: 0.3,
  similarity_standard_deviation: 0.1,
  similarity_threshold: 0.5,
  similarity_std_multiplier: 2,
  blocked_threshold: 0.385,
};

describe("jobs API contracts", () => {
  it("trims queries and defaults to no selected blockers", () => {
    expect(parseJobSearchRequest({ query: "  remote analyst  " })).toEqual({
      query: "remote analyst",
      userBlockers: [],
    });
  });

  it("rejects blank, oversized, or unknown-blocker requests", () => {
    expect(parseJobSearchRequest({ query: "   " })).toBeNull();
    expect(parseJobSearchRequest({ query: "x".repeat(201) })).toBeNull();
    expect(parseJobSearchRequest({ query: "remote", userBlockers: ["unknown:condition"] })).toBeNull();
  });

  it("converts the Python response to the web contract and strips unsafe links", () => {
    const result = parseWorkerResult({
      jobs: [job, { ...job, url: "javascript:alert(1)" }],
      blocked_jobs: [{ ...job, blocked: true }],
      summary,
    });

    expect(result?.jobs).toHaveLength(2);
    expect(result?.jobs[0].url).toBe("https://example.com/job");
    expect(result?.jobs[1].url).toBeNull();
    expect(result?.blockedJobs).toHaveLength(1);
    expect(result?.summary.visibleMatches).toBe(3);
    expect(result?.summary.jobsExcludedByCompany).toBe(2);
  });

  it("parses the public API response contract", () => {
    const response = {
      jobs: [],
      blockedJobs: [],
      summary: {
        query: "remote analyst",
        selectedBlockers: [],
        inputJobs: 10,
        jobsExcludedByCompany: 0,
        companiesExcluded: 0,
        jobsScored: 10,
        similarityMatches: 0,
        requestedModalities: [],
        modalityFilterApplied: false,
        modalityExcludedMatches: 0,
        blockedMatches: 0,
        visibleMatches: 0,
        verifiedCompanyMatches: 0,
        similarityThreshold: 0.5,
      },
    };
    expect(parseJobSearchResponse(response)).toEqual(response);
  });

  it("posts a search request and returns the validated response", async () => {
    const response = {
      jobs: [],
      blockedJobs: [],
      summary: {
        query: "remote analyst",
        selectedBlockers: [],
        inputJobs: 10,
        jobsExcludedByCompany: 0,
        companiesExcluded: 0,
        jobsScored: 10,
        similarityMatches: 0,
        requestedModalities: [],
        modalityFilterApplied: false,
        modalityExcludedMatches: 0,
        blockedMatches: 0,
        visibleMatches: 0,
        verifiedCompanyMatches: 0,
        similarityThreshold: 0.5,
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(response))));
    await expect(searchJobs({ query: "remote analyst", userBlockers: [] })).resolves.toEqual(response);
  });

  it("rejects malformed worker responses", () => {
    expect(parseWorkerResult({ jobs: [], blocked_jobs: [], summary: {} })).toBeNull();
  });
});
