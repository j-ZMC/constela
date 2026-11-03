import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadRecommendedCache, recommendedCacheKey, saveRecommendedCache } from "@/lib/recommended-cache";

const response = {
  jobs: [],
  blockedJobs: [],
  summary: {
    query: "Python analyst",
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

describe("recommended result cache", () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
    });
  });

  it("returns saved results for the same request", () => {
    const request = { query: "Python analyst", userBlockers: [], customBlockers: [] };
    saveRecommendedCache(request, response);
    expect(loadRecommendedCache(request)).toEqual(response);
  });

  it("uses a different cache key when the profile request changes", () => {
    const base = { query: "Python analyst", userBlockers: [], customBlockers: [] };
    const key = recommendedCacheKey(base);
    expect(recommendedCacheKey({ ...base, userBlockers: ["adhd:distraction_and_interruptions"] })).not.toBe(key);
    expect(recommendedCacheKey({ ...base, customBlockers: ["night shift"] })).not.toBe(key);
  });
});
