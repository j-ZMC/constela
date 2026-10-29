// Profile: the onboarding questions, how answers are stored, and how they become app settings.
// Other modules should only use loadProfile() + toAdaptations(), never raw answers. See SPEC-profile.md.

export const QUESTIONS = [
  {
    id: "reading",
    kind: "single",
    text: "How do you like to read things?",
    options: [
      { value: "summary", label: "Short summaries" },
      { value: "steps", label: "Step by step" },
      { value: "listen", label: "Listen out loud" },
      { value: "full", label: "Full text is fine" },
    ],
  },
  {
    id: "longText",
    kind: "single",
    text: "How do long texts feel?",
    options: [
      { value: "fine", label: "Fine" },
      { value: "tiring", label: "Tiring" },
      { value: "hard", label: "Really hard" },
    ],
  },
  {
    id: "unclear",
    kind: "single",
    text: "When instructions aren't clear, what usually happens?",
    options: [
      { value: "ask", label: "I ask" },
      { value: "guess", label: "I guess" },
      { value: "stuck", label: "I get stuck" },
    ],
  },
  {
    id: "changes",
    kind: "single",
    text: "How do last-minute changes feel?",
    options: [
      { value: "fine", label: "Fine" },
      { value: "heads-up", label: "I need a heads-up" },
      { value: "stressful", label: "Very stressful" },
    ],
  },
  {
    id: "sensory",
    kind: "multi",
    text: "What bothers you in a workplace?",
    options: [
      { value: "noise", label: "Noise" },
      { value: "lights", label: "Bright lights" },
      { value: "crowds", label: "Crowds" },
      { value: "textures", label: "Some textures (uniforms, fabrics)" },
      { value: "smells", label: "Strong smells" },
      { value: "none", label: "Nothing in particular" },
    ],
  },
  {
    id: "startBlockers",
    kind: "multi",
    text: "What makes it hard to get started?",
    options: [
      { value: "too-many-options", label: "Too many options" },
      { value: "big-tasks", label: "Big tasks" },
      { value: "time", label: "Losing track of time" },
      { value: "distracted", label: "Getting distracted" },
      { value: "none", label: "Nothing in particular" },
    ],
  },
  {
    id: "workplace",
    kind: "multi",
    text: "Where would you like to work?",
    options: [
      { value: "remote", label: "Remote" },
      { value: "hybrid", label: "Hybrid" },
      { value: "on-site", label: "On-site" },
      { value: "not-sure", label: "Not sure yet" },
    ],
  },
  {
    id: "support",
    kind: "single",
    text: "How much support would you like at work?",
    options: [
      { value: "independent", label: "I'm fine on my own" },
      { value: "check-ins", label: "Some check-ins" },
      { value: "regular", label: "Regular support" },
    ],
  },
] as const;

type Question = (typeof QUESTIONS)[number];
type ValueOf<Id extends Question["id"]> = Extract<Question, { id: Id }>["options"][number]["value"];
type AnswerOf<Q extends Question> = Q["kind"] extends "multi" ? ValueOf<Q["id"]>[] : ValueOf<Q["id"]>;

export type Answers = { [Q in Question as Q["id"]]?: AnswerOf<Q> };
export type Sensory = Exclude<ValueOf<"sensory">, "none">;
export type Workplace = Exclude<ValueOf<"workplace">, "not-sure">;

export type Adaptations = {
  summaryMode: boolean;
  listenButton: boolean;
  suggestReadingAids: boolean;
  explicitSteps: boolean;
  headsUpOnChanges: boolean;
  sensoryNeeds: Sensory[];
  stepsAtOnce: 1 | 3;
  offerBreakdownFirst: boolean;
  showDurations: boolean;
  importantFirst: boolean;
  workplaceFilters: Workplace[];
  gentlePacing: boolean;
};

export const DEFAULT_ADAPTATIONS: Adaptations = {
  summaryMode: false,
  listenButton: false,
  suggestReadingAids: false,
  explicitSteps: false,
  headsUpOnChanges: false,
  sensoryNeeds: [],
  stepsAtOnce: 3,
  offerBreakdownFirst: false,
  showDurations: false,
  importantFirst: false,
  workplaceFilters: [],
  gentlePacing: false,
};

export function toAdaptations(a: Answers): Adaptations {
  const blockers = a.startBlockers ?? [];
  return {
    summaryMode: a.reading === "summary" || a.longText === "tiring" || a.longText === "hard",
    listenButton: a.reading === "listen",
    suggestReadingAids: a.longText === "hard",
    explicitSteps: a.unclear === "guess" || a.unclear === "stuck",
    headsUpOnChanges: a.changes === "heads-up" || a.changes === "stressful",
    sensoryNeeds: (a.sensory ?? []).filter((s): s is Sensory => s !== "none"),
    stepsAtOnce: blockers.includes("too-many-options") ? 1 : 3,
    offerBreakdownFirst: blockers.includes("big-tasks"),
    showDurations: blockers.includes("time"),
    importantFirst: blockers.includes("distracted"),
    workplaceFilters: (a.workplace ?? []).filter((w): w is Workplace => w !== "not-sure"),
    gentlePacing: a.support === "check-ins" || a.support === "regular",
  };
}

// Plain-language lines for the summary screen, most useful first. The summary shows the first few
// up front and the rest on request, so no chosen adaptation is ever hidden.
// For the job filter (backend/config/neurodivergence_job_barriers.json): the barrier subtypes this person's answers
// point to. Only subtype ids, never the category they sit under: the profile asks about needs, not diagnoses.
// A match is a signal to review a job, not a reason to hide it.
export type JobPreferences = { barriers: string[]; workplace: string[] };

const BARRIERS: Partial<Record<string, string[]>> = {
  "sensory:noise": ["sound", "sensory_load"],
  "sensory:lights": ["visual_and_light"],
  "sensory:crowds": ["smell_touch_temperature_and_crowding"],
  "sensory:textures": ["smell_touch_temperature_and_crowding"],
  "sensory:smells": ["smell_touch_temperature_and_crowding"],
  "longText:tiring": ["high_reading_load"],
  "longText:hard": ["high_reading_load", "time_pressure_for_text"],
  "unclear:guess": ["ambiguity_and_task_switching"],
  "unclear:stuck": ["ambiguity_and_task_switching", "ambiguity_and_unpredictability"],
  "changes:heads-up": ["uncertainty_and_last_minute_changes"],
  "changes:stressful": ["uncertainty_and_last_minute_changes", "ambiguity_and_unpredictability"],
  "startBlockers:distracted": ["distraction_and_interruptions"],
  "startBlockers:time": ["time_pressure_and_rigidity"],
};

export function toJobPreferences(a: Answers): JobPreferences {
  const picked = Object.entries(a).flatMap(([q, v]) => (Array.isArray(v) ? v : [v]).map((x) => `${q}:${x}`));
  const barriers = [...new Set(picked.flatMap((k) => BARRIERS[k] ?? []))];
  const workplace = (a.workplace ?? []).filter((w) => w !== "not-sure");
  return { barriers, workplace };
}

export function describeAdaptations(a: Adaptations): string[] {
  const lines = [
    a.stepsAtOnce === 1 && "We'll show you one step at a time.",
    a.offerBreakdownFirst && "Big tasks get broken into small steps first.",
    a.importantFirst && "The most important thing comes first; the rest stays out of the way.",
    a.summaryMode && "Texts start as short summaries. You can always read more.",
    a.listenButton && "You'll see a Listen button to hear texts out loud.",
    a.explicitSteps && "Instructions come as numbered steps with an example.",
    a.headsUpOnChanges && "We'll tell you what to expect before interviews and changes.",
    a.showDurations && "Each step shows how long it takes.",
    a.sensoryNeeds.length > 0 && "Jobs that may not suit your sensory needs will be flagged.",
    a.workplaceFilters.length > 0 && "Jobs are filtered to where you'd like to work.",
    a.gentlePacing && "We'll check in with you along the way.",
  ].filter((l): l is string => typeof l === "string");
  return lines.length > 0 ? lines : ["We'll use the standard settings. You can change them anytime."];
}

// Multi-select toggle where "none" / "not-sure" can't be combined with real answers.
const EXCLUSIVE = ["none", "not-sure"];
export function toggleOption(current: readonly string[], value: string): string[] {
  if (current.includes(value)) return current.filter((v) => v !== value);
  if (EXCLUSIVE.includes(value)) return [value];
  return [...current.filter((v) => !EXCLUSIVE.includes(v)), value];
}

const STORAGE_KEY = "profile";
const STEP_KEY = "profile-step";
const VERSION = 1;

// Which screen the person was on, so a reload resumes there. -1 = welcome.
export function loadStep(): number {
  try {
    const raw = localStorage.getItem(STEP_KEY);
    if (raw === null) return -1;
    const step = Number(raw);
    return Number.isInteger(step) && step >= -1 && step <= QUESTIONS.length ? step : -1;
  } catch {
    return -1;
  }
}

export function saveStep(step: number): void {
  try {
    localStorage.setItem(STEP_KEY, String(step));
  } catch {
    // Same as saveProfile: in-memory only.
  }
}

// Storage can be edited by hand, so keep only answers that match a real option.
function sanitize(raw: Record<string, unknown>): Answers {
  const clean: Record<string, unknown> = {};
  for (const q of QUESTIONS) {
    const allowed: readonly string[] = q.options.map((o) => o.value);
    const value = raw[q.id];
    if (q.kind === "multi") {
      if (Array.isArray(value)) {
        const valid = value.filter((v) => allowed.includes(v));
        if (valid.length > 0) clean[q.id] = valid;
      }
    } else if (typeof value === "string" && allowed.includes(value)) {
      clean[q.id] = value;
    }
  }
  return clean as Answers;
}

export function loadProfile(): Answers | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== VERSION || typeof data.answers !== "object" || data.answers === null) return null;
    return sanitize(data.answers);
  } catch {
    return null;
  }
}

export function saveProfile(answers: Answers): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, answers }));
  } catch {
    // Private mode or blocked storage: the app keeps working with the answers in memory.
  }
}
