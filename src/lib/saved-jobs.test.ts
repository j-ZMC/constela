import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/jobs";
import { loadPlan } from "@/lib/plan";
import { MAX_SAVED, jobKey, markApplied, parseSavedJobs, saveJob, unsaveJob } from "@/lib/saved-jobs";

const job = (url: string | null, extra: Partial<Job> = {}): Job => ({
  title: "Remote analyst",
  company: "Example Co",
  location: "Worldwide",
  modality: "remote",
  modality_classification: "remote",
  salary_min: null,
  salary_max: null,
  currency: "",
  description: "Review data.",
  url,
  date: "2026-10-01",
  source: "example",
  tags: [],
  similarity: 0.8,
  similarity_rank: 1,
  blocked: false,
  block_reasons: [],
  company_verified: true,
  company_verification_status: "qualified",
  ...extra,
});

let store: Record<string, string> = {};
const stored = () => parseSavedJobs(store["saved-jobs"] ?? null);
const events = () => (loadPlan().events ?? []).map((e) => e.type);

describe("saved jobs", () => {
  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
    });
    vi.stubGlobal("window", new EventTarget());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves a job once and tells My plan", () => {
    expect(saveJob(job("https://a.example/1"))).toBe("saved");
    expect(saveJob(job("https://a.example/1"))).toBe("saved");
    expect(stored()).toHaveLength(1);
    expect(events()).toEqual(["job-saved"]);
  });

  it("marks an application as sent and removes jobs", () => {
    const a = job("https://a.example/1");
    saveJob(a);
    markApplied(jobKey(a), new Date("2026-11-02T10:00:00Z"));
    expect(stored()[0].appliedAt).toBe("2026-11-02T10:00:00.000Z");
    expect(events()).toEqual(["job-saved", "application-sent"]);
    unsaveJob(jobKey(a));
    expect(stored()).toEqual([]);
  });

  it("stops at the limit instead of dropping old jobs", () => {
    for (let i = 0; i < MAX_SAVED; i++) saveJob(job(`https://a.example/${i}`));
    expect(saveJob(job("https://a.example/new"))).toBe("full");
    expect(stored()).toHaveLength(MAX_SAVED);
  });

  it("drops stored jobs whose link is not a web link", () => {
    const raw = JSON.stringify([
      { job: job("javascript:alert(1)"), savedAt: "x" },
      { job: job(null), savedAt: "x" },
      { nope: true },
    ]);
    expect(parseSavedJobs(raw).map((s) => s.job.url)).toEqual([null]);
    expect(parseSavedJobs("not json")).toEqual([]);
  });

  it("keeps entries it cannot read when it saves, instead of deleting them", () => {
    store["saved-jobs"] = JSON.stringify([{ job: { title: "From a newer version" }, savedAt: "x" }]);
    saveJob(job("https://a.example/1"));
    markApplied(jobKey(job("https://a.example/1")));
    const raw = JSON.parse(store["saved-jobs"]);
    expect(raw).toHaveLength(2);
    expect(raw[1].job.title).toBe("From a newer version");
  });

  it("marks an application once, even on a double tap", () => {
    const a = job("https://a.example/1");
    saveJob(a);
    markApplied(jobKey(a), new Date("2026-11-02T10:00:00Z"));
    markApplied(jobKey(a), new Date("2026-11-02T10:00:01Z"));
    expect(stored()[0].appliedAt).toBe("2026-11-02T10:00:00.000Z");
    expect(events()).toEqual(["job-saved", "application-sent"]);
  });
});
