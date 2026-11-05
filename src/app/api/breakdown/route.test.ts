import { beforeEach, describe, expect, it, vi } from "vitest";

const breakdownMock = vi.fn();
vi.mock("@/lib/breakdown", async (original) => ({
  ...(await original<typeof import("@/lib/breakdown")>()),
  breakdown: (...args: unknown[]) => breakdownMock(...args),
}));

const { POST } = await import("@/app/api/breakdown/route");
const { BreakdownError } = await import("@/lib/breakdown");

const valid = { task: "Prepare for my interview", explicitSteps: false, summaryMode: true, gentleTone: false };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/breakdown", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/breakdown", () => {
  beforeEach(() => {
    breakdownMock.mockReset();
  });

  it("returns the steps for a valid request", async () => {
    breakdownMock.mockResolvedValue([{ title: "Open the job post", minutes: 2 }]);
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ steps: [{ title: "Open the job post", minutes: 2 }] });
  });

  it("passes only the validated task and flags, and needs no key", async () => {
    breakdownMock.mockResolvedValue([]);
    await post(valid);
    expect(breakdownMock.mock.calls[0]).toEqual([valid]);
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
