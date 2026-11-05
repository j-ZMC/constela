import { describe, expect, it } from "vitest";
import { BreakdownError, breakdown, breakdownRequest, buildPrompt, type BreakdownRequest } from "@/lib/breakdown";
import { OllamaError } from "@/lib/ollama-tools";

const request: BreakdownRequest = {
  task: "Prepare for my interview on Friday",
  explicitSteps: false,
  summaryMode: false,
  gentleTone: false,
};

// Ollama answering with `text`, read as JSON the way localJson does.
const modelReturning = (text: string) => async () => JSON.parse(text);

const steps = (n: number, minutes = 5) =>
  JSON.stringify({ steps: Array.from({ length: n }, (_, i) => ({ title: `Step ${i + 1}`, minutes })) });

describe("breakdownRequest", () => {
  it("accepts a task and the three flags, trimming the task", () => {
    expect(breakdownRequest.parse({ ...request, task: "  Call Ana  " }).task).toBe("Call Ana");
  });

  it.each([
    ["an empty task", { ...request, task: "   " }],
    ["a task over 200 characters", { ...request, task: "x".repeat(201) }],
    ["a missing flag", { task: "Call Ana", explicitSteps: true, summaryMode: true }],
    ["any profile field", { ...request, support: "regular" }],
    ["the check-in feeling", { ...request, energy: "stressed" }],
  ])("rejects %s", (_, body) => {
    expect(breakdownRequest.safeParse(body).success).toBe(false);
  });
});

describe("buildPrompt", () => {
  it("sends only the task, wrapped so it is read as data", () => {
    const { prompt } = buildPrompt(request);
    expect(prompt).toContain("<task>Prepare for my interview on Friday</task>");
  });

  it("always carries the Easy Read rules", () => {
    const { system } = buildPrompt(request);
    expect(system).toMatch(/verb/i);
    expect(system).toMatch(/10 minutes/);
    expect(system).toMatch(/adult/i);
  });

  it("adds fixed app context for a starter step, and rejects unknown ids", () => {
    const { system } = buildPrompt({ ...request, starter: "starter-save" });
    expect(system).toMatch(/Save button/);
    expect(buildPrompt(request).system).not.toMatch(/Constela app/);
    expect(breakdownRequest.safeParse({ ...request, starter: "anything I type" }).success).toBe(false);
  });

  it("turns each flag into an instruction, never into personal data", () => {
    const plain = buildPrompt(request).system;
    const all = buildPrompt({ ...request, explicitSteps: true, summaryMode: true, gentleTone: true }).system;
    expect(all.length).toBeGreaterThan(plain.length);
    expect(all).toMatch(/example/i);
    expect(all).toMatch(/8 words/);
    expect(all).toMatch(/5 minutes/);
    expect(all).not.toMatch(/stress|anxious|energy|support|diagnos|adhd|autis|dyslex/i);
  });
});

describe("breakdown", () => {
  it("returns the model's steps", async () => {
    const result = await breakdown(request, modelReturning(steps(4)));
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ title: "Step 1", minutes: 5 });
  });

  it("keeps at most 6 steps and clamps minutes to 1..10, whole minutes", async () => {
    const text = JSON.stringify({
      steps: [
        { title: "  A  ", minutes: 30 },
        { title: "B", minutes: 0.2 },
        ...Array.from({ length: 6 }, (_, i) => ({ title: `C${i}`, minutes: 3 })),
      ],
    });
    const result = await breakdown(request, modelReturning(text));
    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({ title: "A", minutes: 10 });
    expect(result[1].minutes).toBe(1);
  });

  it("caps minutes at 5 when a gentle tone was asked for", async () => {
    const result = await breakdown({ ...request, gentleTone: true }, modelReturning(steps(3, 9)));
    expect(result.every((s) => s.minutes <= 5)).toBe(true);
  });

  it("drops empty titles and fails if fewer than 3 steps remain", async () => {
    const text = JSON.stringify({ steps: [{ title: "A", minutes: 2 }, { title: " ", minutes: 2 }, { title: "B", minutes: 2 }] });
    await expect(breakdown(request, modelReturning(text))).rejects.toMatchObject({ code: "failed" });
  });

  it("fails on output that doesn't match the schema", async () => {
    await expect(breakdown(request, modelReturning("not json"))).rejects.toBeInstanceOf(BreakdownError);
  });

  it("reports a timeout when Ollama takes too long", async () => {
    const slow = async () => {
      throw new OllamaError("timeout");
    };
    await expect(breakdown(request, slow)).rejects.toMatchObject({ code: "timeout" });
  });

  it("reports Ollama not running, or any other error, as failed", async () => {
    const broken = async () => {
      throw new OllamaError("failed");
    };
    await expect(breakdown(request, broken)).rejects.toMatchObject({ code: "failed" });
  });

  it("sends the rules and the task to the model, with the JSON shape", async () => {
    let seen: { prompt: string; schema: object } | undefined;
    await breakdown(request, async (prompt, schema) => {
      seen = { prompt, schema };
      return JSON.parse(steps(3));
    });
    expect(seen?.prompt).toMatch(/Easy Read[\s\S]*<task>Prepare for my interview on Friday<\/task>/);
    expect(seen?.schema).toMatchObject({ required: ["steps"] });
  });
});
