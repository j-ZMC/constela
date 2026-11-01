import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runResumeParserMock, ResumeWorkerErrorMock } = vi.hoisted(() => {
  class MockResumeWorkerError extends Error {
    constructor(public code: string) {
      super(code);
    }
  }
  return { runResumeParserMock: vi.fn(), ResumeWorkerErrorMock: MockResumeWorkerError };
});

vi.mock("@/lib/resume-worker", () => ({
  runResumeParser: runResumeParserMock,
  ResumeWorkerError: ResumeWorkerErrorMock,
}));

import { POST } from "@/app/api/resume/parse/route";

const profile = {
  name: "Jesus",
  email: "jesus@example.com",
  phone: "5550100100",
  skills_found: ["Python"],
  projects: [],
  experience: [],
  sectors: ["IT"],
};

function request(file?: File) {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("http://localhost/api/resume/parse", { method: "POST", body: form });
}

beforeEach(() => {
  runResumeParserMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/resume/parse", () => {
  it("rejects missing and non-PDF files", async () => {
    expect((await POST(request())).status).toBe(400);
    expect((await POST(request(new File(["text"], "resume.txt", { type: "text/plain" })))).status).toBe(415);
    expect(runResumeParserMock).not.toHaveBeenCalled();
  });

  it("returns validated parser JSON for a PDF", async () => {
    runResumeParserMock.mockResolvedValue(profile);
    const response = await POST(request(new File(["%PDF-1.7"], "resume.pdf", { type: "application/pdf" })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile });
    expect(runResumeParserMock).toHaveBeenCalledOnce();
  });

  it("maps parser failures without exposing details", async () => {
    runResumeParserMock.mockRejectedValue(new ResumeWorkerErrorMock("parse_failed"));
    const response = await POST(request(new File(["%PDF-1.7"], "resume.pdf", { type: "application/pdf" })));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { code: "parse_failed", message: expect.any(String) } });
  });
});
