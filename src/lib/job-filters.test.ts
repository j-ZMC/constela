import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_FILTERS, countWith, filtersOn, loadFilters, matches, saveFilters, yearlyPay } from "@/lib/job-filters";
import type { Job } from "@/lib/jobs";

const job = (extra: Partial<Job>) => ({
  salary_min: null, salary_max: null, salary_period: null, modality_classification: "unknown",
  company_verified: false, company_size: null, ...extra,
}) as Job;

describe("job filters", () => {
  it("uses the middle of the range, as a full-time year", () => {
    expect(yearlyPay(job({ salary_min: 54, salary_max: 60, salary_period: "hour" }))).toBe(118_560);
    expect(yearlyPay(job({ salary_min: 800, salary_max: 800, salary_period: "month" }))).toBe(9_600);
    expect(yearlyPay(job({ salary_min: 18, salary_max: 24 }))).toBeNull();
  });

  it("puts each job in one pay band, so a band leaves some jobs out", () => {
    const jobs = [
      job({ salary_min: 40_000, salary_max: 55_000, salary_period: "year" }), // middle 47,500
      job({ salary_min: 70_000, salary_max: 100_000, salary_period: "year" }), // middle 85,000
      job({ salary_min: 150_000, salary_max: 250_000, salary_period: "year" }), // middle 200,000
      job({}),
    ];
    expect(countWith(jobs, NO_FILTERS, "pay", "0-50000")).toBe(1);
    expect(countWith(jobs, NO_FILTERS, "pay", "80000-120000")).toBe(1);
    expect(countWith(jobs, NO_FILTERS, "pay", "160000-")).toBe(1);
    expect(countWith(jobs, NO_FILTERS, "pay", "listed")).toBe(3);
    expect(countWith(jobs, NO_FILTERS, "pay", "any")).toBe(4);
  });

  it("keeps only the jobs that match every filter", () => {
    const remote = job({ modality_classification: "remote_inferred", salary_min: 70_000, salary_max: 90_000, salary_period: "year", company_size: { size: "large", source: "estimate" }, company_verified: true });
    const office = job({ modality_classification: "on_site" });
    // 70,000 to 90,000: the middle, 80,000, starts the next band up.
    expect(matches(remote, { ...NO_FILTERS, mode: "remote", pay: "80000-120000", size: "large", verified: true })).toBe(true);
    expect(matches(remote, { ...NO_FILTERS, pay: "50000-80000" })).toBe(false);
    expect(matches(office, { ...NO_FILTERS, mode: "remote" })).toBe(false);
    expect(matches(office, { ...NO_FILTERS, pay: "listed" })).toBe(false);
    expect(matches(office, { ...NO_FILTERS, size: "small" })).toBe(false);
    expect(matches(office, NO_FILTERS)).toBe(true);
    expect(filtersOn(NO_FILTERS)).toBe(false);
  });
});

describe("saved filters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps each list's filters, and falls back to any for values edited by hand", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } });
    saveFilters("jobs", { ...NO_FILTERS, mode: "remote" });
    saveFilters("internships", { ...NO_FILTERS, size: "small" });
    expect(loadFilters("jobs").mode).toBe("remote");
    expect(loadFilters("internships")).toEqual({ ...NO_FILTERS, size: "small" });
    store["job-filters"] = JSON.stringify({ jobs: { mode: "moon", pay: "50000-80000", verified: "yes" } });
    expect(loadFilters("jobs")).toEqual({ ...NO_FILTERS, pay: "50000-80000" });
    store["job-filters"] = "not json";
    expect(loadFilters("jobs")).toEqual(NO_FILTERS);
  });
});
