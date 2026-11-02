// Constela for Employers: the rules behind the vacancy editor. See SPEC-employers.md.
// A form can be half filled, so it may hold blank rows and one salary amount; cleanVacancy() turns it into a Vacancy.
import type { VacancyDraft } from "@/lib/employer-ai";
import {
  ENVIRONMENT_FACTORS,
  EXCLUSIONARY_PHRASES,
  MINUTES_RANGE,
  RESPONSE_DAYS_RANGE,
  clarityScore,
  findExclusionaryPhrases,
  vacancySchema,
  type ClarityIssue,
  type EnvironmentFactor,
  type Requirement,
  type Stage,
  type Vacancy,
} from "@/lib/vacancy";

type Salary = NonNullable<Vacancy["salary"]>;
export type VacancyForm = Omit<Vacancy, "salary"> & { salary: Partial<Pick<Salary, "min" | "max">> & Pick<Salary, "currency" | "period"> };

// Names and formats only: a duration is a fact, so the employer gives it, the same rule the AI follows.
export const PROCESS_TEMPLATE: Stage[] = [
  { name: "Answer a few questions in writing", format: "written" },
  { name: "Meet the team", format: "video-call", alternative: "written" },
];

const NO_SALARY: VacancyForm["salary"] = { currency: "MXN", period: "month" };

export function emptyForm(id: string): VacancyForm {
  return { id, status: "draft", company: "", title: "", summary: "", tasks: [], essential: [], niceToHave: [], salary: NO_SALARY, accommodations: [], process: [] };
}

export const formFromVacancy = (v: Vacancy): VacancyForm => ({ ...v, salary: v.salary ?? NO_SALARY });

// An AI draft only ever fills a draft: candidates see nothing until the employer checks it and publishes.
export function formFromDraft(draft: VacancyDraft, id: string): VacancyForm {
  return { ...emptyForm(id), ...draft, id, status: "draft", company: draft.company ?? "", salary: draft.salary ?? NO_SALARY };
}

const lines = (items: string[]) => items.map((line) => line.trim()).filter(Boolean);
const requirements = (items: Requirement[]) => items.map((r) => ({ ...r, text: r.text.trim() })).filter((r) => r.text);
const optional = (text?: string) => text?.trim() || undefined;

export function cleanVacancy(form: VacancyForm): Vacancy {
  const { min, max, currency, period } = form.salary;
  const [low, high] = [min ?? max, max ?? min];
  return {
    ...form,
    company: form.company.trim(),
    title: form.title.trim(),
    summary: form.summary.trim(),
    tasks: lines(form.tasks),
    essential: requirements(form.essential),
    niceToHave: requirements(form.niceToHave),
    salary: low && high ? { min: low, max: high, currency, period } : undefined,
    schedule: optional(form.schedule),
    location: optional(form.location),
    accommodations: lines(form.accommodations),
    // A step with any detail stays, so the employer is told to finish it instead of losing it.
    process: form.process.map((s) => ({ ...s, name: s.name.trim(), who: optional(s.who) })).filter((s) => s.name || s.minutes || s.who),
  };
}

const PROBLEMS: Partial<Record<keyof Vacancy, string>> = {
  title: "Add the job title.",
  company: "Add the company name.",
  salary: "Check the salary: use amounts above 0, with the lowest first.",
  process: `Check the hiring steps: each one needs a name, and a duration from ${MINUTES_RANGE[0]} to ${MINUTES_RANGE[1]} minutes.`,
  responseDays: `Say when you will answer: from ${RESPONSE_DAYS_RANGE[0]} to ${RESPONSE_DAYS_RANGE[1]} days.`,
};

// A draft needs what every stored vacancy needs. Clarity never blocks saving: the score guides, the employer decides.
export function saveProblems(v: Vacancy): string[] {
  const parsed = vacancySchema.safeParse(v);
  if (parsed.success) return [];
  const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
  // In the order of the form, so the employer can read down the page.
  const known = Object.entries(PROBLEMS).flatMap(([field, problem]) => (fields.has(field) ? [problem] : []));
  return known.length > 0 ? known : ["Check the details and try again."];
}

export function publishProblems(v: Vacancy): string[] {
  return [...saveProblems(v), ...(v.process.length === 0 ? ["Add at least one hiring step."] : [])];
}

// The job post in six parts, in the order the employer fills them in.
export const PARTS = [
  { id: "job", name: "The job" },
  { id: "pay", name: "Pay and hours" },
  { id: "day", name: "Typical day" },
  { id: "needs", name: "What you need" },
  { id: "workplace", name: "Workplace" },
  { id: "steps", name: "Hiring steps" },
] as const;
export type PartId = (typeof PARTS)[number]["id"];
export type PartStatus = { id: PartId; name: string; fixes: ClarityIssue[]; left: number; empty: boolean };

const ISSUE_PARTS: Record<string, PartId> = {
  modality: "job",
  salary: "pay",
  schedule: "pay",
  tasks: "day",
  essential: "needs",
  environment: "workplace",
  accommodations: "workplace",
  process: "steps",
};

// fixes are what the part still needs. Vague phrases count in left too, but each one shows under its own line.
export function partStatuses(v: Vacancy): PartStatus[] {
  const needs = [...v.essential, ...v.niceToHave].map((r) => r.text);
  const lines: Record<PartId, string[]> = { job: [v.title, v.summary], pay: [], day: v.tasks, needs, workplace: [], steps: [] };
  const empty: Record<PartId, boolean> = {
    job: !v.title && !v.company && !v.summary && !v.modality && !v.location,
    pay: !v.salary && !v.schedule,
    day: v.tasks.length === 0,
    needs: needs.length === 0,
    workplace: !v.environment && v.accommodations.length === 0,
    steps: v.process.length === 0 && !v.responseDays,
  };
  // The score can't ask for these, because a stored vacancy always has them or doesn't need them to be clear.
  const required: (ClarityIssue & { part: PartId; when: boolean })[] = [
    { part: "job", when: !v.title, id: "title", points: 0, fix: PROBLEMS.title as string },
    { part: "job", when: !v.company, id: "company", points: 0, fix: PROBLEMS.company as string },
    { part: "needs", when: needs.length === 0, id: "needs", points: 0, fix: "List what the job needs." },
  ];
  const issues = clarityScore(v).issues.filter((issue) => !issue.id.startsWith("phrase:"));
  return PARTS.map(({ id, name }) => {
    const fixes = [...required.filter((r) => r.part === id && r.when), ...issues.filter((issue) => ISSUE_PARTS[issue.id] === id)];
    return { id, name, fixes, left: fixes.length + lines[id].flatMap(findExclusionaryPhrases).length, empty: empty[id] };
  });
}

export const thingsLeft = (v: Vacancy) => partStatuses(v).reduce((sum, part) => sum + part.left, 0);
export const leftText = (left: number) => (left === 0 ? "Nothing left to fix." : left === 1 ? "1 thing left." : `${left} things left.`);

// Where the AI needs a fact it doesn't have, it leaves a [bracket] for the employer to fill in.
export const hasBlank = (text: string) => /\[[^\]]*\]/.test(text);

export type TextPart = { text: string; marked: boolean };

// Every occurrence, so the employer sees each one in their own words. Phrases that overlap share one mark.
export function markPhrases(text: string): TextPart[] {
  const found = EXCLUSIONARY_PHRASES.flatMap(({ pattern }) =>
    [...text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))].map((m) => ({ start: m.index, end: m.index + m[0].length })),
  ).sort((a, b) => a.start - b.start);

  const merged: typeof found = [];
  for (const range of found) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }

  const parts: TextPart[] = [];
  let at = 0;
  for (const { start, end } of merged) {
    if (start > at) parts.push({ text: text.slice(at, start), marked: false });
    parts.push({ text: text.slice(start, end), marked: true });
    at = end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), marked: false });
  return parts;
}

// Unticking the last box means "not described", not "offers none": only the employer can say that, with its own choice.
export function toggleFactor(current: Vacancy["environment"], factor: EnvironmentFactor, on: boolean): Vacancy["environment"] {
  const next = new Set(current);
  if (on) next.add(factor);
  else next.delete(factor);
  return next.size > 0 ? ENVIRONMENT_FACTORS.filter((f) => next.has(f)) : undefined;
}
