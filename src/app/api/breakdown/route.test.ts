import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const breakdownMock = vi.fn();
vi.mock("@/lib/breakdown", async (original) => ({
  ...(await original<typeof import("@/lib/breakdown")>()),
  breakdown: (...args: unknown[]) => breakdownMock(...args),
}));
vi.mock("@ai-sdk/groq", () => ({ createGroq: () => (id: string) => ({ id }) }));

const { POST } = await import("@/app/api/breakdown/route");
const { BreakdownError } = await import("@/lib/breakdown");

const valid = { task: "Prepare for my interview", explicitSteps: false, summaryMode: true, gentleTone: false };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/breakdown", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/breakdown", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "");
    breakdownMock.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns the steps for a valid request", async () => {
    breakdownMock.mockResolvedValue([{ title: "Open the job post", minutes: 2 }]);
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ steps: [{ title: "Open the job post", minutes: 2 }] });
  });

  it("passes only the validated task and flags, with the default model", async () => {
    breakdownMock.mockResolvedValue([]);
    await post(valid);
    const [request, model] = breakdownMock.mock.calls[0];
    expect(request).toEqual(valid);
    expect(model).toEqual({ id: "openai/gpt-oss-20b" });
  });

  it("uses GROQ_MODEL when set", async () => {
    vi.stubEnv("GROQ_MODEL", "qwen/qwen3.8-27b");
    breakdownMock.mockResolvedValue([]);
    await post(valid);
    expect(breakdownMock.mock.calls[0][1]).toEqual({ id: "qwen/qwen3.8-27b" });
  });

  it.each([
    ["broken JSON", "{nope"],
    ["a missing task", { ...valid, task: undefined }],
    ["extra profile data", { ...valid, sensory: ["noise"] }],
  ])("rejects %s with invalid_input", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(breakdownMock).not.toHaveBeenCalled();
  });

  it("says not_configured when there is no API key", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const res = await post(valid);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
  });

  it.each([
    ["timeout", 504],
    ["failed", 502],
  ] as const)("maps a %s from the AI call", async (code, status) => {
    breakdownMock.mockRejectedValue(new BreakdownError(code));
    const res = await post(valid);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code });
  });

  it("maps unexpected errors to failed", async () => {
    breakdownMock.mockRejectedValue(new Error("boom"));
    expect((await post(valid)).status).toBe(502);
  });
});
