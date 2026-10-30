import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const aiMock = vi.fn();
vi.mock("@/lib/employer-ai", async (original) => ({
  ...(await original<typeof import("@/lib/employer-ai")>()),
  runEmployerAi: (...args: unknown[]) => aiMock(...args),
}));
vi.mock("@ai-sdk/groq", () => ({ createGroq: () => (id: string) => ({ id }) }));

const { POST } = await import("@/app/api/employer-ai/route");
const { EmployerAiError } = await import("@/lib/employer-ai");

const valid = { task: "rewrite", text: "Team player" };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/employer-ai", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/employer-ai", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "");
    aiMock.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns the task's result for a valid request", async () => {
    aiMock.mockResolvedValue({ text: "Work with [number] people" });
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Work with [number] people" });
  });

  it("passes only the validated request, with the default model", async () => {
    aiMock.mockResolvedValue({ text: "" });
    await post(valid);
    const [request, model] = aiMock.mock.calls[0];
    expect(request).toEqual(valid);
    expect(model).toEqual({ id: "openai/gpt-oss-20b" });
  });

  it("uses GROQ_MODEL when set", async () => {
    vi.stubEnv("GROQ_MODEL", "qwen/qwen3.8-27b");
    aiMock.mockResolvedValue({ text: "" });
    await post(valid);
    expect(aiMock.mock.calls[0][1]).toEqual({ id: "qwen/qwen3.8-27b" });
  });

  it.each([
    ["broken JSON", "{nope"],
    ["an unknown task", { task: "rank", text: "Analyst" }],
    ["a missing text", { task: "extract" }],
    ["candidate data", { ...valid, candidateId: "c-1042" }],
  ])("rejects %s with invalid_input", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(aiMock).not.toHaveBeenCalled();
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
    aiMock.mockRejectedValue(new EmployerAiError(code));
    const res = await post(valid);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code });
  });

  it("maps unexpected errors to failed", async () => {
    aiMock.mockRejectedValue(new Error("boom"));
    expect((await post(valid)).status).toBe(502);
  });
});
