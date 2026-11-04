import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import {
  EmployerAiError,
  buildPrompt,
  employerAiRequest,
  runEmployerAi,
  type EmployerAiRequest,
  type InterviewQuestion,
  type VacancyDraft,
} from "@/lib/employer-ai";
import { DEMO_VACANCY, clarityScore, vacancySchema, type Vacancy } from "@/lib/vacancy";

const answer = (output: unknown) => ({
  content: [{ type: "text" as const, text: typeof output === "string" ? output : JSON.stringify(output) }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 20, text: 20, reasoning: undefined },
  },
  warnings: [],
});

function modelReturning(output: unknown) {
  return new MockLanguageModelV4({ doGenerate: async () => answer(output) });
}

// Answers in turn, one per call, repeating the last.
function modelAnswering(...outputs: unknown[]) {
  let call = 0;
  return new MockLanguageModelV4({ doGenerate: async () => answer(outputs[Math.min(call++, outputs.length - 1)]) });
}

const POSTING = `Junior Data Analyst at Ceiba Foods, Guadalajara.
We are a fast-paced, dynamic team. Pay is $18,000 to $22,000 MXN a month, Monday to Friday.
You write basic SQL queries and update the sales dashboard every week.
Hiring: a 30-minute video call with the team lead. We answer in 5 days.`;

const CARD = {
  title: "Junior Data Analyst",
  company: "Ceiba Foods",
  summary: "We are a fast-paced, dynamic team.",
  tasks: ["Write basic SQL queries", "Update the sales dashboard every week", "  "],
  essential: [{ text: "SQL", skill: "sql" }],
  niceToHave: [],
  salary: { min: 18000, max: 22000, currency: "MXN", period: "month" },
  schedule: "Monday to Friday",
  modality: "on-site",
  location: "Guadalajara",
  environment: null,
  accommodations: [],
  process: [{ name: "Video call", format: "video-call", minutes: 30, who: "Team lead", alternative: null }],
  responseDays: 5,
};

async function extract(change: Record<string, unknown> = {}, text = POSTING) {
  const result = await runEmployerAi({ task: "extract", text }, modelReturning({ ...CARD, ...change }));
  return (result as { vacancy: VacancyDraft }).vacancy;
}

const asVacancy = (draft: VacancyDraft): Vacancy => ({ id: "v-1", status: "draft", company: "Ceiba Foods", ...draft });

const rewrite = (text: string, output: unknown) => runEmployerAi({ task: "rewrite", text }, modelReturning(output));

const INTERVIEW: EmployerAiRequest = {
  task: "interview",
  title: "Junior Data Analyst",
  tasks: ["Write a weekly summary"],
  essential: ["Write basic SQL queries", "Use Excel formulas"],
};
const question = (requirement: number) => ({
  requirement,
  question: "Show a query you wrote for a real report.",
  strong: "Explains the query and what the report showed.",
  basic: "Describes the query in general terms.",
});

async function interview(questions: unknown[], request = INTERVIEW) {
  const result = await runEmployerAi(request, modelReturning({ questions }));
  return (result as { questions: InterviewQuestion[] }).questions;
}

const REQUESTS: [string, EmployerAiRequest][] = [
  ["extract", { task: "extract", text: POSTING }],
  ["rewrite", { task: "rewrite", text: "Team player" }],
  ["interview", INTERVIEW],
];

describe("employerAiRequest", () => {
  it("accepts each task and trims the text", () => {
    expect(employerAiRequest.parse({ task: "extract", text: "  Analyst  " })).toEqual({ task: "extract", text: "Analyst" });
    expect(employerAiRequest.parse({ task: "rewrite", text: "Team player" }).task).toBe("rewrite");
    expect(employerAiRequest.parse(INTERVIEW).task).toBe("interview");
  });

  it.each([
    ["an unknown task", { task: "rank", text: "Analyst" }],
    ["an empty posting", { task: "extract", text: "   " }],
    ["a posting over 8,000 characters", { task: "extract", text: "x".repeat(8001) }],
    ["a rewrite over 400 characters", { task: "rewrite", text: "x".repeat(401) }],
    ["an interview with no essential requirements", { ...INTERVIEW, essential: [] }],
    ["candidate data with a posting", { task: "extract", text: "Analyst", candidateId: "c-1042" }],
    ["needs with a rewrite", { task: "rewrite", text: "Team player", needs: ["quiet_space"] }],
    ["a profile with an interview", { ...INTERVIEW, profile: { name: "Maya" } }],
  ])("rejects %s", (_, body) => {
    expect(employerAiRequest.safeParse(body).success).toBe(false);
  });
});

describe("what reaches the provider", () => {
  const sentTo = (model: MockLanguageModelV4) => JSON.stringify(model.doGenerateCalls[0].prompt);

  it("sends only the posting, wrapped so it is read as data", async () => {
    const model = modelReturning(CARD);
    await runEmployerAi({ task: "extract", text: POSTING }, model);
    const [system, user] = model.doGenerateCalls[0].prompt;
    expect(system.role).toBe("system");
    expect(user).toMatchObject({ role: "user", content: [{ type: "text", text: `<vacancy>${POSTING}</vacancy>` }] });
    expect(model.doGenerateCalls[0].prompt).toHaveLength(2);
  });

  it("sends a rewrite only the line, wrapped so it is read as data", async () => {
    const model = modelReturning({ text: "Work with [number] people" });
    await runEmployerAi({ task: "rewrite", text: "Team player" }, model);
    expect(sentTo(model)).toContain("<line>Team player</line>");
  });

  it("sends an interview only the title, tasks and essential requirements", () => {
    const { prompt } = buildPrompt(INTERVIEW);
    expect(prompt).toBe(
      "<job>\nJob title: Junior Data Analyst\nTasks:\n- Write a weekly summary\nEssential requirements:\n1. Write basic SQL queries\n2. Use Excel formulas\n</job>",
    );
  });

  it("never names a diagnosis in the fixed rules", () => {
    const rules = [buildPrompt({ task: "extract", text: "x" }), buildPrompt({ task: "rewrite", text: "Team player" }), buildPrompt(INTERVIEW)];
    for (const { system } of rules) expect(system).not.toMatch(/diagnos|adhd|autis|dyslex/i);
  });
});

describe("the schema the model must follow", () => {
  type JsonObject = { type?: unknown; properties?: Record<string, unknown>; required?: string[]; additionalProperties?: unknown };

  const objectsIn = (node: unknown): JsonObject[] => {
    if (typeof node !== "object" || node === null) return [];
    const own = (node as JsonObject).type === "object" ? [node as JsonObject] : [];
    return [...own, ...Object.values(node).flatMap(objectsIn)];
  };

  // Groq's strict mode needs every field listed and nothing extra. An .optional() would pass every other test here and
  // only fail against the real API.
  it.each(REQUESTS)("%s lists every field as required, with no extras", async (_, request) => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("only the request matters here");
      },
    });
    await runEmployerAi(request, model).catch(() => undefined);
    const format = model.doGenerateCalls[0].responseFormat;
    const objects = objectsIn(format?.type === "json" ? format.schema : undefined);
    expect(objects.length).toBeGreaterThan(0);
    for (const o of objects) {
      expect([...(o.required ?? [])].sort()).toEqual(Object.keys(o.properties ?? {}).sort());
      expect(o.additionalProperties).toBe(false);
    }
  });
});

describe("the rules the model gets", () => {
  it("tells extract to copy facts, keep vague phrases, and use the vocabularies", () => {
    const { system } = buildPrompt({ task: "extract", text: "x" });
    expect(system).toMatch(/Never guess a salary/);
    expect(system).toMatch(/Do not soften, improve or remove vague phrases/);
    expect(system).toContain("google_sheets (Google Sheets)");
    expect(system).toContain("quiet_space (Quiet place to work)");
    expect(system).toContain("paid-task");
  });

  it("names the phrases to replace in a rewrite, and asks for brackets instead of invented facts", () => {
    const { system } = buildPrompt({ task: "rewrite", text: "A fast-paced team player" });
    expect(system).toContain('"fast-paced", "team player"');
    expect(system).toMatch(/Never invent a fact/);
    expect(system).toMatch(/square brackets/);
    expect(system).toContain("Handle about [number] [tasks] a [day or week]"); // the small model follows examples, not rules alone
  });

  it("gives the rewrite the length of the field it goes back into", () => {
    expect(buildPrompt({ task: "rewrite", text: "Team player" }).system).toContain("at most 120 characters");
    expect(buildPrompt({ task: "rewrite", text: `Team player ${"x".repeat(120)}` }).system).toContain("at most 400 characters");
  });

  it("keeps interviews on real work and away from personal topics", () => {
    const { system } = buildPrompt(INTERVIEW);
    expect(system).toMatch(/Never write hypothetical questions/);
    expect(system).toMatch(/Never ask about health, disability, age/);
    expect(system).toMatch(/Never judge eye contact/);
  });

  it("keeps the rubric at the level of the requirement", () => {
    expect(buildPrompt(INTERVIEW).system).toMatch(/Never ask for more than the requirement says/);
  });
});

describe("extract", () => {
  it("turns the model's card into a draft that is a valid vacancy once the app adds its id and status", async () => {
    const draft = await extract();
    expect(vacancySchema.safeParse({ id: "v-1", status: "draft", ...draft }).success).toBe(true);
    expect(draft).toMatchObject({
      title: "Junior Data Analyst",
      company: "Ceiba Foods",
      tasks: ["Write basic SQL queries", "Update the sales dashboard every week"],
      salary: { min: 18000, max: 22000, currency: "MXN", period: "month" },
      modality: "on-site",
      responseDays: 5,
    });
  });

  it("drops skills outside the vocabulary and keeps the requirement", async () => {
    const draft = await extract({
      essential: [
        { text: "SQL", skill: "sql" },
        { text: "COBOL", skill: "cobol" },
        { text: "Driving licence", skill: null },
      ],
    });
    expect(draft.essential).toEqual([{ text: "SQL", skill: "sql" }, { text: "COBOL" }, { text: "Driving licence" }]);
  });

  it("drops environment ids and modalities outside the vocabulary", async () => {
    const draft = await extract({ environment: ["quiet_space", "free_snacks"], modality: "metaverse" });
    expect(draft.environment).toEqual(["quiet_space"]);
    expect(draft.modality).toBeUndefined();
  });

  it("leaves an environment the AI found nothing about as not described, so the score keeps asking", async () => {
    const draft = await extract({ environment: [] });
    expect(draft.environment).toBeUndefined();
    expect(clarityScore(asVacancy(draft)).issues.map((i) => i.id)).toContain("environment");
  });

  it("leaves out a company the posting doesn't name, but needs a title", async () => {
    expect((await extract({ company: null })).company).toBeUndefined();
    await expect(extract({ title: "  " })).rejects.toMatchObject({ code: "failed" });
  });

  it("keeps a salary written with separators and drops one that isn't in the posting", async () => {
    const invented = await extract({ salary: { min: 30000, max: 35000, currency: "MXN", period: "month" } });
    expect(invented.salary).toBeUndefined();
    expect(clarityScore(asVacancy(invented)).issues.map((i) => i.id)).toContain("salary");

    const written = await extract({ salary: { min: 25.5, max: 25.5, currency: "usd", period: "HOUR" } }, "Pay is $25.50 an hour.");
    expect(written.salary).toEqual({ min: 25.5, max: 25.5, currency: "USD", period: "hour" });
  });

  it.each([
    ["an unknown currency", { min: 18000, max: 22000, currency: "EUR", period: "month" }],
    ["an unknown period", { min: 18000, max: 22000, currency: "MXN", period: "fortnight" }],
    ["a range upside down", { min: 22000, max: 18000, currency: "MXN", period: "month" }],
  ])("drops a salary with %s instead of failing", async (_, salary) => {
    expect((await extract({ salary })).salary).toBeUndefined();
  });

  it("drops durations and response times that aren't in the posting or don't fit", async () => {
    const draft = await extract({
      process: [
        { name: "Invented length", format: "written", minutes: 45, who: null, alternative: null },
        { name: "Too short", format: "written", minutes: 3, who: null, alternative: null },
        { name: "Stated", format: "written", minutes: 30, who: null, alternative: "paid-task" },
      ],
      responseDays: 14,
    });
    expect(draft.process.map((s) => s.minutes)).toEqual([undefined, undefined, 30]);
    expect(draft.process[2].alternative).toBe("paid-task");
    expect(draft.responseDays).toBeUndefined();
  });

  it("drops a hiring step with an unknown format and any unknown alternative", async () => {
    const draft = await extract({
      process: [
        { name: "Chat", format: "coffee", minutes: null, who: null, alternative: null },
        { name: "Call", format: "video-call", minutes: null, who: null, alternative: "video-call" },
      ],
    });
    expect(draft.process).toEqual([{ name: "Call", format: "video-call" }]);
  });

  it("cuts long text and long lists to the limits of the vacancy", async () => {
    const draft = await extract({
      title: "T".repeat(100),
      summary: "S".repeat(500),
      tasks: Array.from({ length: 12 }, (_, i) => `Task ${i + 1} ${"x".repeat(130)}`),
      essential: Array.from({ length: 12 }, (_, i) => ({ text: `Requirement ${i + 1}`, skill: null })),
      process: Array.from({ length: 8 }, () => ({ name: "Call", format: "video-call", minutes: null, who: null, alternative: null })),
    });
    expect(draft.title).toHaveLength(80);
    expect(draft.summary).toHaveLength(400);
    expect(draft.tasks).toHaveLength(10);
    expect(draft.tasks.every((t) => t.length <= 120)).toBe(true);
    expect(draft.essential).toHaveLength(10);
    expect(draft.process).toHaveLength(6);
    expect(vacancySchema.safeParse({ id: "v-1", status: "draft", company: "Ceiba Foods", ...draft }).success).toBe(true);
  });

  it("keeps vague phrases, so the clarity score can flag them", async () => {
    const draft = await extract();
    expect(clarityScore(asVacancy(draft)).issues.map((i) => i.id)).toEqual(
      expect.arrayContaining(["phrase:fast-paced", "phrase:dynamic"]),
    );
  });
});

describe("rewrite", () => {
  it("returns the new line, with brackets for what the employer must fill in", async () => {
    await expect(rewrite("Work in a fast-paced team", { text: "  Handle about [number] orders a day  " })).resolves.toEqual({
      text: "Handle about [number] orders a day",
    });
  });

  it("makes no call for a line with nothing vague", async () => {
    const model = modelReturning({ text: "unused" });
    await expect(runEmployerAi({ task: "rewrite", text: "Write basic SQL queries" }, model)).resolves.toEqual({
      text: "Write basic SQL queries",
    });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("keeps numbers the line already had", async () => {
    await expect(rewrite("Team player for 3 stores", { text: "Work with [who] at 3 stores" })).resolves.toEqual({
      text: "Work with [who] at 3 stores",
    });
  });

  it("accepts a rewrite that only takes words away, with no bracket", async () => {
    await expect(rewrite("Acme wants a rockstar analyst for its dynamic team", { text: "Acme wants an analyst for its team" })).resolves.toEqual({
      text: "Acme wants an analyst for its team", // "an" is grammar, not a fact
    });
  });

  it("accepts another form of the same word: it is not a new fact", async () => {
    await expect(rewrite("Team player who reviews code with other developers", { text: "Review code with other developers" })).resolves.toEqual({
      text: "Review code with other developers",
    });
    await expect(rewrite("A people person who greets visitors at the front desk", { text: "Greet visitors at the front desk" })).resolves.toEqual({
      text: "Greet visitors at the front desk",
    });
  });

  it("accepts grammar words, which can't carry a fact on their own", async () => {
    await expect(rewrite("SQL ninja to maintain our reporting database", { text: "Maintain our reporting database using SQL" })).resolves.toEqual({
      text: "Maintain our reporting database using SQL",
    });
  });

  it.each([
    ["a new word next to a known one", "Self-starter who builds Power BI dashboards", "Build Power BI dashboards independently"],
    ["a new duty", "A people person who greets visitors at the front desk", "Greet visitors at the front desk and answer the phone"],
    ["a short word that only looks like part of a longer one", "Team player who takes care of customers", "Take car of customers"],
    ["a vague phrase swapped for another vague one", "Must be able to multitask", "Perform several tasks simultaneously"],
  ])("still refuses %s", async (_, line, text) => {
    await expect(rewrite(line, { text })).rejects.toMatchObject({ code: "failed" });
  });

  it("accepts new words next to a bracket: the employer still has to fill in the fact", async () => {
    await expect(rewrite("Team player", { text: "Work with [who] on [which tasks]" })).resolves.toEqual({ text: "Work with [who] on [which tasks]" });
  });

  it.each([
    ["keeps a vague phrase", { text: "Be a real team player" }],
    ["swaps in another vague phrase", { text: "Thrive under pressure" }],
    ["invents a number", { text: "Handle about 20 orders a day" }],
    ["adds facts without a bracket", { text: "Collaborate across departments to meet project deadlines" }],
    ["comes back empty", { text: "   " }],
    ["doesn't fit the field", { text: "Work with others ".repeat(10) }],
  ])("fails when the model %s", async (_, output) => {
    await expect(rewrite("Team player", output)).rejects.toMatchObject({ code: "failed" });
  });
});

describe("interview", () => {
  it("ties each question to its essential requirement", async () => {
    const [first, second] = await interview([question(1), question(2)]);
    expect(first).toMatchObject({ requirement: "Write basic SQL queries", question: "Show a query you wrote for a real report." });
    expect(second.requirement).toBe("Use Excel formulas");
  });

  it("drops questions tied to no requirement or missing a rubric", async () => {
    const questions = await interview([question(1), question(3), question(0), { ...question(2), strong: "  " }]);
    expect(questions).toHaveLength(1);
  });

  it("fails when no question is left", async () => {
    await expect(interview([question(9)])).rejects.toMatchObject({ code: "failed" });
  });

  it("keeps at most 6 questions", async () => {
    const many: EmployerAiRequest = { ...INTERVIEW, essential: Array.from({ length: 8 }, (_, i) => `Requirement ${i + 1}`) };
    const questions = await interview(Array.from({ length: 8 }, (_, i) => question(i + 1)), many);
    expect(questions).toHaveLength(6);
  });
});

describe("one more try", () => {
  const VAGUE = "Work in a fast-paced team";

  it("tries again after an answer that breaks the schema, which the small model sometimes returns", async () => {
    const model = modelAnswering("not json", { text: "Handle about [number] orders a day" });
    await expect(runEmployerAi({ task: "rewrite", text: VAGUE }, model)).resolves.toEqual({ text: "Handle about [number] orders a day" });
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it("tries again after an answer the rules reject", async () => {
    const model = modelAnswering({ text: "Handle about 20 orders a day" }, { text: "Handle about [number] orders a day" });
    await expect(runEmployerAi({ task: "rewrite", text: VAGUE }, model)).resolves.toEqual({ text: "Handle about [number] orders a day" });
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it("tells the model why a rewrite was refused, so the second try can fix it", async () => {
    const line = "Team player who reviews code with other developers";
    const model = modelAnswering({ text: "Review code collaboratively with other developers" }, { text: "Review code with other developers" });
    await expect(runEmployerAi({ task: "rewrite", text: line }, model)).resolves.toEqual({ text: "Review code with other developers" });
    const [first, second] = model.doGenerateCalls.map((call) => JSON.stringify(call.prompt));
    expect(first).not.toContain("was not used");
    expect(second).toContain(`Your last answer was \\"Review code collaboratively with other developers\\". It was not used.`);
    expect(second).toContain("It added words the line doesn't have: collaboratively.");
  });

  it.each([
    [{ text: "Handle about 20 orders a day" }, "It added numbers the line doesn't have: 20."],
    [{ text: "Be a real team player" }, "It added words the line doesn't have: real, player."],
    [{ text: "Work in a fast-paced team" }, `It still had a vague phrase: \\"fast-paced\\".`],
    [{ text: "Work with others ".repeat(10) }, "It was longer than 120 characters."],
  ])("names the rule that refused %o", async (output, reason) => {
    const model = modelAnswering(output, { text: "Handle about [number] orders a day" });
    await runEmployerAi({ task: "rewrite", text: VAGUE }, model);
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain(reason);
  });

  it("asks again plainly after a broken answer, which has nothing to explain", async () => {
    const model = modelAnswering("not json", { text: "Handle about [number] orders a day" });
    await runEmployerAi({ task: "rewrite", text: VAGUE }, model);
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).not.toContain("was not used");
  });

  it("gives up after the second try", async () => {
    const model = modelAnswering({ text: "Handle about 20 orders a day" });
    await expect(runEmployerAi({ task: "rewrite", text: VAGUE }, model)).rejects.toMatchObject({ code: "failed" });
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it("makes one call when the first answer is good", async () => {
    const model = modelAnswering({ text: "Handle about [number] orders a day" });
    await runEmployerAi({ task: "rewrite", text: VAGUE }, model);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it.each(REQUESTS)("%s also gets its second try", async (_, request) => {
    const model = modelAnswering("not json");
    await expect(runEmployerAi(request, model)).rejects.toMatchObject({ code: "failed" });
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it("shares one time limit between both tries", async () => {
    let calls = 0;
    const slow = new MockLanguageModelV4({
      doGenerate: async ({ abortSignal }) => {
        calls++;
        return new Promise((_, reject) => abortSignal?.addEventListener("abort", () => reject(abortSignal.reason)));
      },
    });
    await expect(runEmployerAi({ task: "rewrite", text: VAGUE }, slow, 20)).rejects.toMatchObject({ code: "timeout" });
    expect(calls).toBe(1);
  });
});

describe("errors", () => {
  it.each(REQUESTS)("%s fails on output that doesn't match the schema", async (_, request) => {
    await expect(runEmployerAi(request, modelReturning("not json"))).rejects.toBeInstanceOf(EmployerAiError);
  });

  it.each(REQUESTS)("%s reports a timeout when the call is aborted by its time limit", async (_, request) => {
    const slow = new MockLanguageModelV4({
      doGenerate: async ({ abortSignal }) =>
        new Promise((_, reject) => abortSignal?.addEventListener("abort", () => reject(abortSignal.reason))),
    });
    await expect(runEmployerAi(request, slow, 20)).rejects.toMatchObject({ code: "timeout" });
  });

  it.each(REQUESTS)("%s reports a provider error as failed", async (_, request) => {
    const broken = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("rate limited");
      },
    });
    await expect(runEmployerAi(request, broken)).rejects.toMatchObject({ code: "failed" });
  });
});

it("works on the demo vacancy's own text", async () => {
  const request = { task: "interview" as const, title: DEMO_VACANCY.title, tasks: DEMO_VACANCY.tasks, essential: DEMO_VACANCY.essential.map((r) => r.text) };
  expect(employerAiRequest.safeParse(request).success).toBe(true);
});
