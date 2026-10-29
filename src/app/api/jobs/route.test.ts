import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runJobsWorkerMock, JobsWorkerErrorMock } = vi.hoisted(() => {
  class MockJobsWorkerError extends Error {
    constructor(public code: string) {
      super(code);
    }
  }
  return { runJobsWorkerMock: vi.fn(), JobsWorkerErrorMock: MockJobsWorkerError };
});

vi.mock("@/lib/jobs-worker", () => ({
  runJobsWorker: runJobsWorkerMock,
  JobsWorkerError: JobsWorkerErrorMock,
}));

import { POST } from "@/app/api/jobs/route";

const validSummary = {
  query: "remote analyst",
  selected_blockers: [],
  input_jobs: 10,
  jobs_excluded_by_company: 0,
  companies_excluded: 0,
  jobs_scored: 10,
  similarity_matches: 0,
  requested_modalities: [],
  modality_filter_applied: false,
  modality_excluded_matches: 0,
  blocked_similarity_matches: 0,
  visible_matches: 0,
  verified_company_matches: 0,
  similarity_threshold: 0.5,
};

function request(body: unknown) {
  return new Request("http://localhost/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-only";
  runJobsWorkerMock.mockReset();
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe("POST /api/jobs", () => {
  it("rejects invalid requests before starting Python", async () => {
    const response = await POST(request({ query: "   " }));
    expect(response.status).toBe(400);
    expect(runJobsWorkerMock).not.toHaveBeenCalled();
  });

  it("returns setup-required when the server key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await POST(request({ query: "remote analyst" }));
    expect(response.status).toBe(503);
    expect(runJobsWorkerMock).not.toHaveBeenCalled();
  });

  it("returns a validated worker result", async () => {
    runJobsWorkerMock.mockResolvedValue({ jobs: [], blocked_jobs: [], summary: validSummary });
    const response = await POST(request({ query: "remote analyst" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ jobs: [], blockedJobs: [], summary: { visibleMatches: 0 } });
  });

  it("maps worker timeouts to a generic gateway timeout", async () => {
    runJobsWorkerMock.mockRejectedValue(new JobsWorkerErrorMock("timeout"));
    const response = await POST(request({ query: "remote analyst" }));
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: { code: "timeout", message: expect.any(String) } });
  });
});
