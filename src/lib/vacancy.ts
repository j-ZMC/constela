// Constela for Employers: the vacancy (FichaVacante), the vocabularies it shares with candidates, and the clarity score.
// See SPEC-employers.md. All rules are deterministic; the AI only proposes text and the employer reviews it before saving.
import { z } from "zod";

// What a job can offer, as situations and never diagnoses. A vacancy says which it offers; a candidate picks which they
// need (src/lib/work-profile.ts maps the barrier survey onto these on the candidate's side).
export const ENVIRONMENT = {
  quiet_space: "Quiet place to work",
  soft_lighting: "Soft or natural light",
  calm_surroundings: "No crowds, strong smells or extreme temperatures",
  focus_time: "Long stretches without interruptions",
  stable_priorities: "Priorities that rarely change at the last minute",
  steady_pace: "Steady pace with realistic deadlines",
  flexible_breaks: "Freedom to take breaks and move around",
  predictable_schedule: "Fixed schedule, no on-call or rotating shifts",
  written_communication: "Instructions and updates in writing",
  limited_public_contact: "Little phone or face-to-face work with the public",
  assistive_tools: "Spell-check, text-to-speech and calculators welcome",
  typed_records: "Typing instead of handwriting",
  light_physical_work: "Little lifting, standing or precise handwork",
  step_by_step_training: "Step-by-step training at your own pace",
  varied_work: "Varied, challenging work with room to grow",
  autonomy: "Freedom to decide how to do the work",
  no_distressing_content: "No graphic content, crises or aggressive situations",
  no_cleaning_or_care_duties: "No cleaning chemicals, bodily fluids or personal care",
} as const;
export type EnvironmentFactor = keyof typeof ENVIRONMENT;
export const ENVIRONMENT_FACTORS = Object.keys(ENVIRONMENT) as [EnvironmentFactor, ...EnvironmentFactor[]];
export const factorNames = (factors: EnvironmentFactor[]) => factors.map((f) => ENVIRONMENT[f]).join(", ");

// shortcut: a small curated vocabulary keeps matching exact and explainable; move to ESCO when vacancies need skills outside it.
export const SKILLS = {
  sql: "SQL",
  python: "Python",
  r: "R",
  excel: "Excel",
  google_sheets: "Google Sheets",
  power_bi: "Power BI",
  tableau: "Tableau",
  data_entry: "Data entry",
  javascript: "JavaScript",
  typescript: "TypeScript",
  react: "React",
  vue: "Vue",
  git: "Git",
  software_testing: "Software testing",
  test_automation: "Test automation",
  web_accessibility: "Web accessibility",
  figma: "Figma",
  sketch: "Sketch",
  graphic_design: "Graphic design",
  photo_editing: "Photo editing",
  video_editing: "Video editing",
  technical_writing: "Technical writing",
  copywriting: "Copywriting",
  proofreading: "Proofreading",
  translation: "Spanish–English translation",
  research: "Desk research",
  bookkeeping: "Bookkeeping",
  quickbooks: "QuickBooks",
  xero: "Xero",
  scheduling: "Scheduling and calendars",
  written_support: "Customer support by chat or email",
  phone_support: "Customer support by phone",
  zendesk: "Zendesk",
  freshdesk: "Freshdesk",
  inventory: "Inventory management",
  quality_inspection: "Quality inspection",
  electronics_assembly: "Electronics assembly",
} as const;
export type SkillId = keyof typeof SKILLS;
export const SKILL_IDS = Object.keys(SKILLS) as [SkillId, ...SkillId[]];

// Tools that can stand in for each other. An equivalent counts half in the ranking (src/lib/work-profile.ts).
export const EQUIVALENT_SKILLS: readonly (readonly SkillId[])[] = [
  ["excel", "google_sheets"],
  ["python", "r"],
  ["power_bi", "tableau"],
  ["javascript", "typescript"],
  ["react", "vue"],
  ["figma", "sketch"],
  ["quickbooks", "xero"],
  ["zendesk", "freshdesk"],
];

export const MODALITIES = ["remote", "hybrid", "on-site"] as const;
export type Modality = (typeof MODALITIES)[number];
export const MODALITY_LABELS: Record<Modality, string> = { remote: "Remote", hybrid: "Hybrid", "on-site": "On-site" };

export const CURRENCIES = ["MXN", "USD"] as const;
export const SALARY_PERIODS = ["hour", "month", "year"] as const;

// The last three are the alternative formats: a written first stage, a work sample, a paid practical task.
export const STAGE_FORMATS = ["video-call", "phone-call", "in-person", "written", "work-sample", "paid-task"] as const;
export const ALTERNATIVE_FORMATS = ["written", "work-sample", "paid-task"] as const;
export const STAGE_FORMAT_LABELS: Record<(typeof STAGE_FORMATS)[number], string> = {
  "video-call": "Video call",
  "phone-call": "Phone call",
  "in-person": "In person",
  written: "Written answers",
  "work-sample": "Work sample",
  "paid-task": "Paid task",
};

// Field limits, shared with src/lib/employer-ai.ts so an AI draft always fits.
export const MAX_POSTING = 8000;
export const MAX_SHORT = 80;
export const MAX_LINE = 120;
export const MAX_SUMMARY = 400;
export const MAX_QUESTION = 200;
export const MAX_ITEMS = 10;
export const MAX_STAGES = 6;
export const MINUTES_RANGE = [5, 480] as const;
export const RESPONSE_DAYS_RANGE = [1, 30] as const;

// A requirement is what candidates read; the skill tag is what the ranking matches. Untagged ones are shown but not ranked.
const requirementSchema = z
  .object({ text: z.string().trim().min(1).max(MAX_LINE), skill: z.enum(SKILL_IDS).optional() })
  .strict();

const stageSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_SHORT),
    format: z.enum(STAGE_FORMATS),
    minutes: z.number().int().min(MINUTES_RANGE[0]).max(MINUTES_RANGE[1]).optional(),
    who: z.string().trim().min(1).max(MAX_SHORT).optional(),
    alternative: z.enum(ALTERNATIVE_FORMATS).optional(), // what the candidate can choose instead, e.g. written answers
  })
  .strict();

export const vacancySchema = z
  .object({
    id: z.string().min(1).max(64),
    status: z.enum(["draft", "published"]),
    company: z.string().trim().min(1).max(MAX_SHORT),
    title: z.string().trim().min(1).max(MAX_SHORT),
    summary: z.string().trim().max(MAX_SUMMARY),
    tasks: z.array(z.string().trim().min(1).max(MAX_LINE)).max(MAX_ITEMS),
    // Up to 10 so a long list can be stored and flagged; the clarity score asks for 5 or fewer.
    essential: z.array(requirementSchema).max(MAX_ITEMS),
    niceToHave: z.array(requirementSchema).max(MAX_ITEMS),
    salary: z
      .object({
        min: z.number().positive(),
        max: z.number().positive(),
        currency: z.enum(CURRENCIES),
        period: z.enum(SALARY_PERIODS),
      })
      .strict()
      .refine((s) => s.min <= s.max, "The minimum salary is above the maximum.")
      .optional(),
    schedule: z.string().trim().min(1).max(MAX_SHORT).optional(),
    modality: z.enum(MODALITIES).optional(),
    location: z.string().trim().min(1).max(MAX_SHORT).optional(),
    // Missing means "not described yet"; an empty list means the job offers none of these.
    environment: z.array(z.enum(ENVIRONMENT_FACTORS)).max(ENVIRONMENT_FACTORS.length).optional(),
    accommodations: z.array(z.string().trim().min(1).max(MAX_LINE)).max(MAX_ITEMS),
    process: z.array(stageSchema).max(MAX_STAGES),
    // The promised answer time after each stage.
    responseDays: z.number().int().min(RESPONSE_DAYS_RANGE[0]).max(RESPONSE_DAYS_RANGE[1]).optional(),
  })
  .strict();

export type Vacancy = z.infer<typeof vacancySchema>;
export type Requirement = Vacancy["essential"][number];
export type Stage = Vacancy["process"][number];

export function salaryText(s: NonNullable<Vacancy["salary"]>): string {
  const money = (n: number) => n.toLocaleString("en-US");
  return `${s.currency} ${s.min === s.max ? money(s.min) : `${money(s.min)} to ${money(s.max)}`} per ${s.period}`;
}

export function offersAlternativeFormat(v: Vacancy): boolean {
  return v.process.some((s) => s.alternative !== undefined || (ALTERNATIVE_FORMATS as readonly string[]).includes(s.format));
}

// Vague phrases that screen people out without describing the job. A demand that is truly essential survives as a
// concrete task ("Answer 20 customer emails a day"), which none of these patterns flag.
export const EXCLUSIONARY_PHRASES = [
  { id: "fast-paced", pattern: /\bfast[- ]paced\b/i, hint: "Say how much work comes in, for example “about 20 orders a day”." },
  {
    id: "dynamic",
    pattern: /\bdynamic\s+(?:[\w-]+\s+){0,2}(?:environment|team|workplace|setting|culture|company)\b/i,
    hint: "Say what changes and how often.",
  },
  { id: "team-player", pattern: /\bteam[- ]player\b/i, hint: "Say who the person works with and how, for example “a 15-minute team call every Monday”." },
  {
    id: "communication",
    pattern: /\b(?:excellent|strong|great|good|outstanding|exceptional|superb)\s+(?:(?:written|verbal|oral|interpersonal|and)[\s,&]+){0,4}communication\b/i,
    hint: "Name the real task, for example “Write a weekly status update”.",
  },
  { id: "interpersonal", pattern: /\binterpersonal skills\b|\bpeople person\b/i, hint: "Describe the contact with people the job really needs." },
  {
    id: "organized",
    pattern: /\b(?:excellent|strong|great|good|exceptional)\s+organi[sz]ational skills\b|\bhighly organi[sz]ed\b/i,
    hint: "Say what the person keeps track of and with which tools.",
  },
  { id: "pressure", pattern: /\bunder pressure\b|\bhigh[- ]pressure\b/i, hint: "Give the real deadlines, for example “reports are due every Friday”." },
  { id: "multitasking", pattern: /\bmulti-?task(?:s|ing|er)?\b|\bjuggl(?:e|ing)\b/i, hint: "List the tasks and how the person moves between them." },
  { id: "self-starter", pattern: /\bself[- ]starter\b/i, hint: "Say how much guidance the person gets and from whom." },
  { id: "many-hats", pattern: /\bwear(?:ing)?\s+(?:many|multiple|different)\s+hats\b/i, hint: "List the duties." },
  { id: "other-duties", pattern: /\bother duties as (?:assigned|needed|required)\b/i, hint: "List the duties." },
  { id: "rockstar", pattern: /\b(?:rock ?star|ninja|guru|unicorn)\b/i, hint: "Use the job title." },
  {
    id: "personality",
    pattern: /\b(?:outgoing|bubbly|extroverted)\s+(?:personality|person|individual|attitude)\b|\b(?:energetic|high[- ]energy)\b/i,
    hint: "Describe the tasks, not a personality.",
  },
  { id: "culture-fit", pattern: /\bcultur(?:e|al) fit\b/i, hint: "Name your values and what they look like day to day." },
  {
    id: "ambiguity",
    pattern: /\bthink on (?:your|their) feet\b|\b(?:comfortable with|thrives? (?:in|with)|handles?|tolerates?)\s+ambiguity\b/i,
    hint: "Say which decisions the person makes and who helps.",
  },
  { id: "ground-running", pattern: /\bhit the ground running\b/i, hint: "Describe the first weeks and the training." },
] as const;

export type PhraseMatch = { id: string; match: string; hint: string };

// One match per phrase, with the exact words found so the UI can highlight them in the pasted text.
export function findExclusionaryPhrases(text: string): PhraseMatch[] {
  return EXCLUSIONARY_PHRASES.flatMap(({ id, pattern, hint }) => {
    const found = text.match(pattern);
    return found ? [{ id, match: found[0], hint }] : [];
  });
}

// Versioned so a saved score always says which rules produced it: change a rule, bump the version.
export const CLARITY_VERSION = 1;
export const CLEAR_SCORE = 80; // a vacancy counts as clear at 80 or more (target: 90% of vacancies)
const MAX_ESSENTIAL = 5;
const PHRASE_POINTS = 5;
const MAX_PHRASE_POINTS = 20;

export type ClarityIssue = { id: string; points: number; fix: string };
export type Clarity = { version: typeof CLARITY_VERSION; score: number; issues: ClarityIssue[] };

// Starts at 100 and every missing piece costs points; the deductions add up to exactly 100, so the score never goes below 0.
export function clarityScore(v: Vacancy): Clarity {
  const issues: ClarityIssue[] = [];
  const deduct = (when: boolean, id: string, points: number, fix: string) => {
    if (when) issues.push({ id, points, fix });
  };
  deduct(!v.salary, "salary", 15, "Add the salary range.");
  deduct(v.tasks.length < 3, "tasks", 10, "Describe at least 3 tasks from a typical day.");
  deduct(!v.schedule, "schedule", 10, "Add the work schedule.");
  deduct(!v.modality, "modality", 10, "Say if the job is remote, hybrid or on-site.");
  deduct(v.essential.length > MAX_ESSENTIAL, "essential", 10, `Keep ${MAX_ESSENTIAL} essential requirements or fewer. Move the rest to nice to have.`);
  deduct(!v.environment, "environment", 10, "Describe the work environment.");
  deduct(
    v.process.length === 0 || v.process.some((s) => !s.minutes) || !v.responseDays,
    "process",
    10,
    "Give each hiring step a duration and say when you will answer.",
  );
  deduct(v.accommodations.length === 0, "accommodations", 5, "List the adjustments you offer by default.");

  const text = [v.title, v.summary, ...v.tasks, ...v.essential.map((r) => r.text), ...v.niceToHave.map((r) => r.text)].join("\n");
  let phrasePoints = 0;
  for (const phrase of findExclusionaryPhrases(text)) {
    // Past the cap, phrases still show so each one can be fixed, but they stop costing points.
    const points = Math.min(PHRASE_POINTS, MAX_PHRASE_POINTS - phrasePoints);
    phrasePoints += points;
    issues.push({ id: `phrase:${phrase.id}`, points, fix: `Replace “${phrase.match}”. ${phrase.hint}` });
  }
  return { version: CLARITY_VERSION, score: 100 - issues.reduce((sum, i) => sum + i.points, 0), issues };
}

// A clear, published vacancy for the demo and the tests. Ceiba Foods is fictional.
export const DEMO_VACANCY: Vacancy = {
  id: "demo-data-analyst",
  status: "published",
  company: "Ceiba Foods",
  title: "Junior Data Analyst",
  summary: "Turn weekly sales data into short reports for the store managers.",
  tasks: [
    "Pull last week's sales data with SQL",
    "Update the sales dashboard in Power BI",
    "Write a one-page summary for store managers every Friday",
  ],
  essential: [
    { text: "Write basic SQL queries", skill: "sql" },
    { text: "Use Excel formulas and pivot tables", skill: "excel" },
    { text: "Build simple charts and dashboards", skill: "power_bi" },
  ],
  niceToHave: [{ text: "Clean data with Python", skill: "python" }],
  salary: { min: 18000, max: 22000, currency: "MXN", period: "month" },
  schedule: "Monday to Friday, 9:00 to 17:00",
  modality: "hybrid",
  location: "Guadalajara, Jalisco",
  environment: ["quiet_space", "focus_time", "steady_pace", "predictable_schedule", "written_communication", "assistive_tools"],
  accommodations: ["Noise-cancelling headphones", "Interview questions sent 48 hours before", "Flexible start time"],
  process: [
    { name: "Answer 3 questions in writing", format: "written", minutes: 30 },
    { name: "Make a small sales report (paid)", format: "paid-task", minutes: 90 },
    { name: "Meet the data team", format: "video-call", minutes: 30, who: "Data team lead", alternative: "written" },
  ],
  responseDays: 5,
};
