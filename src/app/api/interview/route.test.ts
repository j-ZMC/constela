import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const interviewMock = vi.fn();
vi.mock("@/lib/interview", async (original) => ({
  ...(await original<typeof import("@/lib/interview")>()),
  interview: (...args: unknown[]) => interviewMock(...args),
}));
vi.mock("@ai-sdk/groq", () => ({ createGroq: () => (id: string) => ({ id }) }));

const { POST } = await import("@/app/api/interview/route");
const { InterviewError } = await import("@/lib/interview");

const valid = { mode: "practice", question: "Tell me about yourself.", answer: "I like people.", summaryMode: false, gentleTone: true };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/interview", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/interview", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "");
    interviewMock.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns the AI result for a valid request", async () => {
    interviewMock.mockResolvedValue({ feedback: { wentWell: "a", suggestion: "b" } });
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ feedback: { wentWell: "a", suggestion: "b" } });
    expect(interviewMock.mock.calls[0][0]).toEqual(valid);
  });

  it.each([
    ["broken JSON", "{nope"],
    ["extra profile data", { ...valid, sensory: ["noise"] }],
  ])("rejects %s with invalid_input", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(interviewMock).not.toHaveBeenCalled();
  });

  it("says not_configured when there is no API key", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect((await post(valid)).status).toBe(503);
  });

  it("maps AI errors", async () => {
    interviewMock.mockRejectedValue(new InterviewError("timeout"));
    expect(await (await post(valid)).json()).toEqual({ error: "timeout" });
    interviewMock.mockRejectedValue(new Error("boom"));
    expect((await post(valid)).status).toBe(502);
  });
});
