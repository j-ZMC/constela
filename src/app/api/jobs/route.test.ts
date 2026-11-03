import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: execFileMock }));

import { execFile } from "node:child_process";
import { POST } from "@/app/api/jobs/route";

const workerResult = {
  jobs: [],
  blocked_jobs: [],
  summary: {
    query: "remote analyst",
    selected_blockers: [],
    input_jobs: 10,
    jobs_excluded_by_company: 0,
    companies_excluded: 0,
    jobs_scored: 10,
    similarity_matches: 0,
    blocked_similarity_matches: 0,
    visible_matches: 0,
    verified_company_matches: 0,
    similarity_threshold: 0.5,
  },
};

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/jobs", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));

function mockWorker(stdout: string, error: Error | null = null) {
  execFileMock.mockImplementation(
    (_file: string, _args: string[], _options: object, callback: (error: Error | null, stdout: string) => void) => {
      callback(error, stdout);
    },
  );
}

describe("POST /api/jobs", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    execFileMock.mockReset();
    (globalThis as { __constelaJobsCache?: Map<string, unknown> }).__constelaJobsCache?.clear();
  });

  it("answers the same search again from its cache, without running Python", async () => {
    mockWorker(JSON.stringify(workerResult));
    const first = await (await post({ query: "remote analyst" })).json();
    const second = await (await post({ query: "remote analyst" })).json();
    expect(second).toEqual(first);
    expect(execFileMock).toHaveBeenCalledTimes(1);
    await post({ query: "nurse" });
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed search", async () => {
    mockWorker("not json");
    await post({ query: "remote analyst" });
    mockWorker(JSON.stringify(workerResult));
    expect((await post({ query: "remote analyst" })).status).toBe(200);
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("runs the Python search and returns its validated results", async () => {
    mockWorker(JSON.stringify(workerResult));

    const response = await post({ query: "remote analyst" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
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
    });
    expect(execFile).toHaveBeenCalledWith(
      expect.any(String),
      ["filter_jobs_openai.py", "--json", "--query", "remote analyst"],
      expect.objectContaining({ timeout: 120_000 }),
      expect.any(Function),
    );
  });

  it("passes selected profile blockers to the local worker", async () => {
    mockWorker(JSON.stringify(workerResult));

    await post({
      query: "remote analyst",
      userBlockers: ["autism_spectrum:sensory_load"],
    });

    expect(execFileMock.mock.calls[0][1]).toEqual([
      "filter_jobs_openai.py",
      "--json",
      "--query",
      "remote analyst",
      "--blocker",
      "autism_spectrum:sensory_load",
    ]);
  });

  it("passes the person's own words in the safe --option=value form", async () => {
    mockWorker(JSON.stringify(workerResult));

    await post({ query: "remote analyst", customBlockers: ["night shift", "-rf"] });

    expect(execFileMock.mock.calls[0][1]).toEqual([
      "filter_jobs_openai.py",
      "--json",
      "--query",
      "remote analyst",
      "--custom-blocker=night shift",
      "--custom-blocker=-rf",
    ]);
  });

  it("searches the internships file, showing all of them, when asked", async () => {
    mockWorker(JSON.stringify(workerResult));

    await post({ query: "marketing", internships: true });

    expect(execFileMock.mock.calls[0][1]).toEqual([
      "filter_jobs_openai.py",
      "--json",
      "--query",
      "marketing",
      "--jobs",
      "data/raw/jobs/internships.json",
      "--emb",
      "data/processed/embeddings/internships_openai_embeddings.npy",
      "--ids",
      "data/processed/embeddings/internships_openai_ids.json",
      "--threshold=-100",
    ]);
  });

  it("rejects invalid requests without starting Python", async () => {
    const response = await post({ query: " " });

    expect(response.status).toBe(400);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("returns not_configured if the OpenAI key is absent", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await post({ query: "remote analyst" });

    expect(response.status).toBe(503);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("returns a backend error when Python returns invalid JSON", async () => {
    mockWorker("not json");

    const response = await post({ query: "remote analyst" });

    expect(response.status).toBe(502);
  });

  it("maps a timed-out Python worker to a gateway timeout", async () => {
    mockWorker("", Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }));

    const response = await post({ query: "remote analyst" });

    expect(response.status).toBe(504);
  });
});
