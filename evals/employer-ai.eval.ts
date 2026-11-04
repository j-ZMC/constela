// Measures the employer AI against the real provider: what the model tries, and what reaches the employer after our
// guards. It calls runEmployerAi exactly as /api/employer-ai does; a recording middleware only watches.
// Run: npm run eval:ai (about 15 minutes, paced under Groq's token limit). Writes evals/REPORT.md and evals/results/latest.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { createGroq } from "@ai-sdk/groq";
import { APICallError, wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import { describe, expect, it } from "vitest";
import { EXTRACT_CASES, INTERVIEW_CASES, REWRITE_CASES, type ExtractGold } from "./cases";
import { json, numbersIn, rewriteIssues, statedIn } from "./checks";
import { percentile, share } from "./stats";
import { EmployerAiError, runEmployerAi, type EmployerAiRequest, type InterviewQuestion, type VacancyDraft } from "@/lib/employer-ai";
import { checkQuestion } from "@/lib/interview-questions";
import { findExclusionaryPhrases } from "@/lib/vacancy";

// Next skips .env.local when NODE_ENV is test, as it is under Vitest, so read it with Node. Existing variables win.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the check below says what is missing.
}
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b"; // the same default as /api/employer-ai
const TOKENS_PER_MINUTE = 7000; // Groq allows 8,000 on this model; the gap absorbs a call that runs long

type Task = EmployerAiRequest["task"];
type Call = { text: string; tokens: number; ms: number; status?: number };
let calls: Call[] = [];
const spent: { at: number; tokens: number }[] = [];
const average: Record<Task, number[]> = { rewrite: [1200], extract: [3500], interview: [2500] };

const recorder: LanguageModelMiddleware = {
  wrapGenerate: async ({ doGenerate }) => {
    const started = performance.now();
    try {
      const result = await doGenerate();
      const tokens = (result.usage.inputTokens.total ?? 0) + (result.usage.outputTokens.total ?? 0);
      const text = result.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
      calls.push({ text, tokens, ms: performance.now() - started });
      spent.push({ at: Date.now(), tokens });
      return result;
    } catch (error) {
      calls.push({ text: "", tokens: 0, ms: performance.now() - started, status: APICallError.isInstance(error) ? error.statusCode : undefined });
      throw error;
    }
  },
};

// Waits outside the request, so the pause never eats into the production time limit.
async function room(task: Task) {
  const mean = average[task].reduce((a, b) => a + b, 0) / average[task].length;
  const need = Math.min(TOKENS_PER_MINUTE, 2 * mean); // room for the second try the route allows
  for (;;) {
    while (spent.length > 0 && Date.now() - spent[0].at > 60_000) spent.shift();
    if (spent.reduce((sum, s) => sum + s.tokens, 0) + need <= TOKENS_PER_MINUTE) return;
    await sleep(Math.max(500, 60_000 - (Date.now() - spent[0].at) + 250));
  }
}

type Run<T> = { value?: T; error?: string; attempts: Call[]; ms: number; limited: number };

async function run<T>(request: EmployerAiRequest, model: Parameters<typeof runEmployerAi>[1]): Promise<Run<T>> {
  let limited = 0;
  for (;;) {
    await room(request.task);
    calls = [];
    const started = performance.now();
    let value: T | undefined;
    let error: string | undefined;
    try {
      value = (await runEmployerAi(request, model)) as T;
    } catch (e) {
      error = e instanceof EmployerAiError ? e.code : "failed";
    }
    const ms = performance.now() - started;
    const attempts = calls;
    attempts.forEach((c) => c.tokens && average[request.task].push(c.tokens));
    // The provider's rate limit is not the model's answer: wait it out and run the case again.
    if (attempts.some((c) => c.status === 429) && limited < 3) {
      limited++;
      await sleep(60_000);
      continue;
    }
    return { value, error, attempts, ms, limited };
  }
}

function draftText(d: VacancyDraft) {
  return [d.title, d.summary, ...d.tasks, ...d.essential.map((r) => r.text), ...d.niceToHave.map((r) => r.text)].join("\n");
}

function extractChecks(gold: ExtractGold, d: VacancyDraft) {
  const minutes = d.process.flatMap((s) => (s.minutes ? [s.minutes] : [])).sort();
  return {
    company: gold.company === null ? d.company === undefined : d.company?.toLowerCase() === gold.company.toLowerCase(),
    salary: gold.salary === null ? d.salary === undefined : d.salary?.min === gold.salary[0] && d.salary?.max === gold.salary[1],
    modality: (d.modality ?? null) === gold.modality,
    responseDays: (d.responseDays ?? null) === gold.responseDays,
    minutes: JSON.stringify(minutes) === JSON.stringify([...gold.minutes].sort()),
    vague: gold.vague.every((phrase) => draftText(d).toLowerCase().includes(phrase.toLowerCase())),
  };
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

describe("employer AI against the real provider", () => {
  it("never lets an invented fact or a vague phrase reach the employer", async () => {
    const apiKey = process.env.GROQ_API_KEY;
    expect(apiKey, "GROQ_API_KEY must be set in .env.local").toBeTruthy();
    const model = wrapLanguageModel({ model: createGroq({ apiKey })(MODEL), middleware: recorder });
    const started = Date.now();

    // Every case must really test something.
    for (const c of REWRITE_CASES) expect(findExclusionaryPhrases(c.line).length, c.line).toBeGreaterThan(0);

    const rewrites = [];
    for (const c of REWRITE_CASES) {
      const r = await run<{ text: string }>({ task: "rewrite", text: c.line }, model);
      const raw = r.attempts.map((a) => ({ text: String(json(a.text)?.text ?? ""), parsed: json(a.text) !== null && a.status === undefined }));
      const delivered = r.value?.text;
      rewrites.push({
        ...c,
        delivered,
        error: r.error,
        ms: r.ms,
        limited: r.limited,
        tokens: sum(r.attempts.map((a) => a.tokens)),
        raw: raw.map((a) => ({ text: a.text, issues: a.parsed ? rewriteIssues(c.line, a.text) : ["broken answer"] })),
        issues: delivered === undefined ? [] : rewriteIssues(c.line, delivered),
        keptFacts: delivered === undefined ? undefined : c.keep.every((k) => delivered.toLowerCase().includes(k.toLowerCase())),
        bracket: delivered?.includes("[") ?? false,
      });
      console.log(`rewrite ${rewrites.length}/${REWRITE_CASES.length}: ${delivered ?? `(${r.error})`}`);
    }

    const extracts: { title: string; error?: string; ms: number; limited: number; tokens: number; rawNumbers: number; rawInvented: unknown[]; deliveredInvented: unknown[]; checks: ReturnType<typeof extractChecks> | null }[] = [];
    for (const gold of EXTRACT_CASES) {
      const r = await run<{ vacancy: VacancyDraft }>({ task: "extract", text: gold.posting }, model);
      const stated = statedIn(gold.posting);
      const rawNumbers = r.attempts.flatMap((a) => numbersIn(json(a.text)));
      const draft = r.value?.vacancy;
      extracts.push({
        title: gold.posting.split("\n")[0],
        error: r.error,
        ms: r.ms,
        limited: r.limited,
        tokens: sum(r.attempts.map((a) => a.tokens)),
        rawNumbers: rawNumbers.length,
        rawInvented: rawNumbers.filter((n) => !stated(n)),
        deliveredInvented: numbersIn(draft ?? null).filter((n) => !stated(n)),
        checks: draft ? extractChecks(gold, draft) : null,
      });
      console.log(`extract ${extracts.length}/${EXTRACT_CASES.length}: ${draft ? JSON.stringify(extracts.at(-1)?.checks) : r.error}`);
    }

    const interviews = [];
    for (const c of INTERVIEW_CASES) {
      const r = await run<{ questions: InterviewQuestion[] }>({ task: "interview", ...c }, model);
      const questions = r.value?.questions ?? [];
      interviews.push({
        title: c.title,
        error: r.error,
        ms: r.ms,
        limited: r.limited,
        tokens: sum(r.attempts.map((a) => a.tokens)),
        essential: c.essential.length,
        covered: new Set(questions.map((q) => q.requirement)).size,
        questions: questions.map((q) => ({ requirement: q.requirement, question: q.question, flags: checkQuestion(q.question).map((f) => f.id) })),
      });
      console.log(`interview ${interviews.length}/${INTERVIEW_CASES.length}: ${questions.length} questions`);
    }

    // ---- The numbers
    const delivered = rewrites.filter((r) => r.delivered !== undefined);
    const firstTry = rewrites.filter((r) => r.delivered !== undefined && r.raw.length === 1);
    const rawAnswers = rewrites.flatMap((r) => r.raw);
    const rejected = rawAnswers.filter((a) => a.issues.length > 0);
    const byIssue = (issue: string) => rawAnswers.filter((a) => a.issues.includes(issue)).length;
    const unsafe = delivered.filter((r) => r.issues.length > 0);
    const withFacts = delivered.filter((r) => r.keep.length > 0);
    const extracted = extracts.filter((e) => e.checks);
    const field = (key: keyof ReturnType<typeof extractChecks>) => extracted.filter((e) => e.checks?.[key]).length;
    const rawNumbers = sum(extracts.map((e) => e.rawNumbers));
    const rawInvented = sum(extracts.map((e) => e.rawInvented.length));
    const deliveredInvented = sum(extracts.map((e) => e.deliveredInvented.length));
    const questions = interviews.flatMap((i) => i.questions);
    const flagged = (id: string) => questions.filter((q) => q.flags.includes(id)).length;
    const all = [...rewrites, ...extracts, ...interviews];
    const tokens = sum(all.map((x) => x.tokens));
    const latency = (list: { ms: number }[]) => `${seconds(percentile(list.map((x) => x.ms), 50))} median, ${seconds(percentile(list.map((x) => x.ms), 95))} at the 95th percentile`;

    const examples = delivered.filter((r) => r.keep.length > 0).slice(0, 4);
    const caught = rewrites.flatMap((r) => r.raw.filter((a) => a.issues.length > 0 && a.text).map((a) => ({ line: r.line, ...a }))).slice(0, 4);
    const date = new Date().toISOString().slice(0, 10);
    // The run kept from before the guards learned word forms and the second try learned why: the same cases, so they compare.
    const BASELINE = "evals/results/baseline.json";
    type Kept = { date: string; rewrites: { line: string; delivered?: string; raw: { issues: string[] }[] }[] };
    const kept = existsSync(BASELINE) ? (JSON.parse(readFileSync(BASELINE, "utf8")) as Kept) : null;
    const keptRaw = kept?.rewrites.flatMap((r) => r.raw) ?? [];
    const compared = kept
      ? `## Compared with the baseline

The same cases, run on ${kept.date} before two changes: the guards now accept another form of the same word ("reviews", "review") and grammar words ("at", "using"), and a refused rewrite goes back to the model with the reason.

| Measure | Baseline | This run |
| --- | --- | --- |
| A rewrite reached the employer | ${share(kept.rewrites.filter((r) => r.delivered !== undefined).length, kept.rewrites.length)} | ${share(delivered.length, rewrites.length)} |
| Answers from the model that the guards refused | ${share(keptRaw.filter((a) => a.issues.length > 0).length, keptRaw.length)} | ${share(rejected.length, rawAnswers.length)} |
| Rewrites with an invented fact or a vague phrase that reached the employer | ${kept.rewrites.filter((r) => r.delivered !== undefined && rewriteIssues(r.line, r.delivered).length > 0).length} | ${unsafe.length} |

`
      : "";

    const report = `# Employer AI evaluation

Model \`${MODEL}\` on Groq, ${date}. ${all.length} cases, ${rawAnswers.length} rewrite answers read one by one, ${tokens.toLocaleString("en-US")} tokens, ${Math.round((Date.now() - started) / 60000)} minutes.
Run it again with \`npm run eval:ai\`, or replay these recorded answers through the current guards, offline and free, with \`npm run eval:replay\`. Every rate has a 95% Wilson interval, because the samples are small.

## What reaches the employer

| Check | Result |
| --- | --- |
| Rewrites with an invented number, a fact with no [bracket], a vague phrase, or too long | **${share(unsafe.length, delivered.length)}** |
| Drafts with a number the posting never stated | **${share(extracts.filter((e) => e.deliveredInvented.length > 0).length, extracted.length)}** |

The evaluation fails if either is above zero.

${compared}## Rewrites (${REWRITE_CASES.length} lines, 2 for each of the 16 vague phrases)

| Measure | Result |
| --- | --- |
| A rewrite reached the employer | ${share(delivered.length, rewrites.length)} |
| ...on the first answer | ${share(firstTry.length, rewrites.length)} |
| Answers from the model that our guards refused | ${share(rejected.length, rawAnswers.length)} |
| ...kept a vague phrase | ${byIssue("keeps a vague phrase")} |
| ...added a fact with no [bracket] | ${byIssue("adds a fact with no [bracket]")} |
| ...added a number | ${byIssue("adds a number")} |
| ...too long, empty or broken | ${byIssue("too long") + byIssue("empty") + byIssue("broken answer")} |
| Delivered rewrites that kept every fact of the line | ${share(withFacts.filter((r) => r.keptFacts).length, withFacts.length)} |
| Delivered rewrites that ask for a fact with a [bracket] | ${share(delivered.filter((r) => r.bracket).length, delivered.length)} |
| Time to an answer | ${latency(rewrites)} |

Examples that reached the employer:

${examples.map((r) => `- "${r.line}" → "${r.delivered}"`).join("\n")}

Answers the guards stopped:

${caught.map((a) => `- "${a.line}" → "${a.text}" (${a.issues.join(", ")})`).join("\n") || "- None in this run."}

## Reading a pasted posting (${EXTRACT_CASES.length} postings)

| Measure | Result |
| --- | --- |
| A draft reached the employer | ${share(extracted.length, extracts.length)} |
| Numbers the model invented, before the guards | ${rawInvented} of ${rawNumbers} |
| Numbers it invented that reached the employer | ${deliveredInvented} |
| Company right, and left empty when the posting names none | ${share(field("company"), extracted.length)} |
| Salary right, and left empty when there is none | ${share(field("salary"), extracted.length)} |
| Work mode right | ${share(field("modality"), extracted.length)} |
| Answer time right, and left empty for "within a week" | ${share(field("responseDays"), extracted.length)} |
| Every step duration right | ${share(field("minutes"), extracted.length)} |
| Vague phrases kept, so the clarity score can flag them | ${share(field("vague"), extracted.length)} |
| Time to an answer | ${latency(extracts)} |

## Interview questions (${INTERVIEW_CASES.length} job posts)

| Measure | Result |
| --- | --- |
| Questions arrived | ${share(interviews.filter((i) => i.questions.length > 0).length, interviews.length)} |
| Essential requirements with a question | ${share(sum(interviews.map((i) => i.covered)), sum(interviews.map((i) => i.essential)))} |
| Questions about the person (age, health, family): the save stops | ${share(flagged("personal"), questions.length)} |
| Questions about an imagined situation: the employer is warned | ${share(flagged("hypothetical"), questions.length)} |
| Vague questions: the employer is warned | ${share(flagged("vague"), questions.length)} |
| Time to an answer | ${latency(interviews)} |

## Limits

- Fixed cases written by the team, in English. They show how the model and the guards behave, not how every posting will go.
- The re-check is written apart from the guards but follows the same rules, so a new kind of invented fact would slip past both. A person still reads every suggestion before using it.
- Rate-limit waits from the provider are not counted as failures: the case runs again.
`;

    mkdirSync("evals/results", { recursive: true });
    writeFileSync("evals/REPORT.md", report);
    writeFileSync("evals/results/latest.json", JSON.stringify({ model: MODEL, date, tokens, rewrites, extracts, interviews }, null, 2));
    console.log(report);

    expect(unsafe.map((r) => `${r.line} → ${r.delivered}: ${r.issues.join(", ")}`)).toEqual([]);
    expect(extracts.flatMap((e) => e.deliveredInvented)).toEqual([]);
  });
});
