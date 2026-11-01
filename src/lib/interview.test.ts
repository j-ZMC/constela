import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { InterviewError, buildPrompt, interview, interviewRequest, type InterviewRequest } from "@/lib/interview";

const practice: InterviewRequest = {
  mode: "practice",
  question: "Tell me about yourself.",
  answer: "I like fixing computers.",
  summaryMode: false,
  gentleTone: false,
};
const ask: InterviewRequest = { mode: "question", role: "", previous: ["Tell me about yourself."], summaryMode: false, gentleTone: false };

function modelReturning(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

describe("interviewRequest", () => {
  it.each([
    ["an empty answer", { ...practice, answer: "  " }],
    ["an answer over 2000 characters", { ...practice, answer: "x".repeat(2001) }],
    ["an unknown mode", { ...practice, mode: "recap" }],
    ["any profile field", { ...practice, support: "regular" }],
    ["the check-in feeling", { ...ask, energy: "stressed" }],
  ])("rejects %s", (_, body) => {
    expect(interviewRequest.safeParse(body).success).toBe(false);
  });
});

describe("buildPrompt", () => {
  it("wraps the person's text in tags and forbids scores and guesses", () => {
    const { system, prompt } = buildPrompt(practice);
    expect(prompt).toContain("<answer>I like fixing computers.</answer>");
    expect(system).toMatch(/score/);
    expect(system).toMatch(/condition/);
  });

  it("asks for a new question that avoids the ones already asked, fitted to the job", () => {
    const { system, prompt } = buildPrompt({ ...ask, role: "Cashier" });
    expect(prompt).toContain("<job>Cashier</job>");
    expect(prompt).toContain("<asked>Tell me about yourself.</asked>");
    expect(system).toMatch(/Do not repeat/);
  });

  it("turns the flags into wording rules only", () => {
    const all = buildPrompt({ ...practice, summaryMode: true, gentleTone: true }).system;
    expect(all).toMatch(/15 words/);
    expect(all).toMatch(/gentle/);
    expect(all).not.toMatch(/stress|anxious|energy|adhd|autis|dyslex/i);
  });
});

describe("interview", () => {
  it("returns trimmed feedback", async () => {
    const result = await interview(practice, modelReturning(JSON.stringify({ wentWell: " Clear start. ", suggestion: "Add one example." })));
    expect(result).toEqual({ feedback: { wentWell: "Clear start.", suggestion: "Add one example." } });
  });

  it("returns a question with at most 4 steps", async () => {
    const steps = ["Say", "Give", "Link", "End", "Extra"];
    const result = await interview(ask, modelReturning(JSON.stringify({ question: "Why this job?", steps })));
    expect(result).toEqual({ question: { question: "Why this job?", steps: steps.slice(0, 4) } });
  });

  it("fails on empty feedback or broken output", async () => {
    await expect(interview(practice, modelReturning(JSON.stringify({ wentWell: " ", suggestion: "x" })))).rejects.toEqual(
      new InterviewError("failed"),
    );
    await expect(interview(ask, modelReturning("not json"))).rejects.toBeInstanceOf(InterviewError);
  });
});
