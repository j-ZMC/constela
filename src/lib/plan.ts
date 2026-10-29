// My plan: the starter path, how steps are stored, and which steps to show now. See SPEC-plan.md.
// Components render and call these; teammates add steps from their modules with addStepToPlan().
import type { Adaptations } from "@/lib/profile";

export const STEP_ICONS = ["user", "briefcase", "bookmark", "building", "message", "calendar", "list"] as const;
export type StepIcon = (typeof STEP_ICONS)[number];

// Self-reported check-in. It stays on the device; the AI only ever gets gentleTone(energy).
export const ENERGY_LEVELS = ["low", "stressed", "okay", "good"] as const;
export type Energy = (typeof ENERGY_LEVELS)[number];

export function gentleTone(energy?: Energy): boolean {
  return energy === "low" || energy === "stressed";
}

// The job search path (SPEC-path.md). Follow up loops back to Look for jobs.
export const STAGES = ["ready", "search", "apply", "interview", "follow-up"] as const;
export type Stage = (typeof STAGES)[number];

// Things other modules report, which can complete a stage ("Save one job" also counts when Jobs says so).
export const PLAN_EVENTS = ["job-saved", "application-sent", "practice-done"] as const;
export type PlanEvent = (typeof PLAN_EVENTS)[number];

const SOURCES = ["starter", "path", "module", "habit", "user", "ai"] as const;

export type PlanStep = {
  id: string;
  title: string;
  minutes: number;
  icon: StepIcon;
  href?: string;
  done: boolean;
  doneAt?: string;
  source: (typeof SOURCES)[number];
  // Missing on steps that belong to no stage (the person's own, AI, habits).
  stage?: Stage;
};

// checkInSkipped: the local date the person skipped the check-in, so it stays hidden that day.
// The path fields are optional, so plans saved before the path existed load unchanged (src/lib/path.ts fills them in).
export type Plan = {
  version: 1;
  steps: PlanStep[];
  energy?: { level: Energy; date: string };
  checkInSkipped?: string;
  stage?: Stage;
  stageOpenedAt?: string; // ISO time; missing means "count everything", for plans that predate the path
  events?: { type: PlanEvent; at: string }[];
  weekGoal?: { stage: Stage; week: string }; // week as YYYY-Www
  lastHabit?: string; // local date a habit step was last added
};

export type NewStep = { title: string; minutes: number; icon?: StepIcon; href?: string; stage?: Stage };

export const STARTER_STEPS: readonly Omit<PlanStep, "done" | "source">[] = [
  { id: "starter-profile", title: "Finish your profile", minutes: 3, icon: "user", href: "/profile", stage: "ready" },
  { id: "starter-jobs", title: "Look at 3 jobs picked for you", minutes: 10, icon: "briefcase", href: "/jobs", stage: "search" },
  { id: "starter-save", title: "Save one job you like", minutes: 2, icon: "bookmark", href: "/jobs", stage: "search" },
  { id: "starter-company", title: "Read “Get to know the company” for that job", minutes: 5, icon: "building", href: "/jobs", stage: "apply" },
  { id: "starter-practice", title: "Practice one interview question", minutes: 5, icon: "message", href: "/interview", stage: "interview" },
  { id: "starter-expect", title: "Read “What to expect” for an interview", minutes: 5, icon: "calendar", href: "/interview", stage: "interview" },
];

// A step's kind without its per-cycle suffix: "starter-jobs:ab12" is another round of "starter-jobs".
export function stepKey(id: string): string {
  return id.split(":")[0];
}

const PROFILE_STEP = "starter-profile";
// Starter steps that only make sense after another one ("that job" needs a saved job).
// shortcut: a prerequisite that was removed or broken down counts as met; track needs on every step if users build longer chains.
const NEEDS: Record<string, string> = { "starter-save": "starter-jobs", "starter-company": "starter-save" };
const SHORT_STEP = 5;
const MAX_MINUTES = 60;
const MAX_TITLE = 80;

export function starterPlan(): Plan {
  return { version: 1, steps: STARTER_STEPS.map((s) => ({ ...s, done: false, source: "starter" })) };
}

// Steps the app marks done by itself, so the person gets no Done button for them.
export function completesItself(id: string): boolean {
  return stepKey(id) === PROFILE_STEP;
}

// The profile step reflects reality: done once a profile exists.
export function syncWithProfile(plan: Plan, hasProfile: boolean): Plan {
  if (!hasProfile) return plan;
  return {
    ...plan,
    steps: plan.steps.map((s) => (completesItself(s.id) && !s.done ? { ...s, done: true, doneAt: new Date().toISOString() } : s)),
  };
}

export function visibleSteps(plan: Plan, a: Adaptations, energy?: Energy): PlanStep[] {
  const todo = plan.steps.filter((s) => !s.done);
  // Low energy and stress pick a smaller step, but never one whose prerequisite is still waiting.
  const ready = todo.filter((s) => !todo.some((t) => stepKey(t.id) === NEEDS[stepKey(s.id)]));
  if (energy === "low") {
    const short = ready.find((s) => s.minutes <= SHORT_STEP) ?? todo[0];
    return short ? [short] : [];
  }
  if (energy === "stressed") {
    // The easiest win first: the shortest step, earliest in the path on a tie.
    const easiest = ready.reduce<PlanStep | undefined>((best, s) => (!best || s.minutes < best.minutes ? s : best), undefined);
    return easiest ? [easiest] : [];
  }
  return todo.slice(0, a.stepsAtOnce);
}

// The check-in is asked once per local day (YYYY-MM-DD, the person's own calendar day).
export function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function todayEnergy(plan: Plan, now: Date): Energy | undefined {
  return plan.energy?.date === localDate(now) ? plan.energy.level : undefined;
}

export function checkInDue(plan: Plan, now: Date): boolean {
  const today = localDate(now);
  return plan.energy?.date !== today && plan.checkInSkipped !== today;
}

// null skips the check-in for today without changing the plan.
export function setEnergy(plan: Plan, level: Energy | null, now: Date): Plan {
  const rest = resetCheckIn(plan);
  return level ? { ...rest, energy: { level, date: localDate(now) } } : { ...rest, checkInSkipped: localDate(now) };
}

// "Change": forget today's answer so the check-in shows again.
export function resetCheckIn(plan: Plan): Plan {
  return { ...plan, energy: undefined, checkInSkipped: undefined };
}

export function completeStep(plan: Plan, id: string, now: Date): Plan {
  return {
    ...plan,
    steps: plan.steps.map((s) => (s.id === id ? { ...s, done: true, doneAt: now.toISOString() } : s)),
  };
}

// From a star's details: put a done step back on the path.
export function undoStep(plan: Plan, id: string): Plan {
  return {
    ...plan,
    steps: plan.steps.map((s) => (s.id === id ? { ...s, done: false, doneAt: undefined } : s)),
  };
}

export function addSteps(plan: Plan, steps: NewStep[], source: PlanStep["source"], afterId?: string): Plan {
  const created: PlanStep[] = steps.map((s) => ({
    id: crypto.randomUUID(),
    title: s.title.trim().slice(0, MAX_TITLE),
    minutes: Math.min(MAX_MINUTES, Math.max(1, Math.round(s.minutes))),
    icon: s.icon ?? "list",
    ...(s.href ? { href: s.href } : {}),
    ...(s.stage ? { stage: s.stage } : {}),
    done: false,
    source,
  }));
  const at = afterId ? plan.steps.findIndex((s) => s.id === afterId) + 1 : plan.steps.length;
  const index = at > 0 ? at : plan.steps.length;
  return { ...plan, steps: [...plan.steps.slice(0, index), ...created, ...plan.steps.slice(index)] };
}

export function removeStep(plan: Plan, id: string): Plan {
  return { ...plan, steps: plan.steps.filter((s) => s.id !== id) };
}

const STORAGE_KEY = "plan";

// Storage can be edited by hand: keep only well-formed steps, and only same-site links.
function validStep(raw: unknown): raw is PlanStep {
  if (typeof raw !== "object" || raw === null) return false;
  const s = raw as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.title === "string" &&
    s.title.trim().length > 0 &&
    s.title.length <= MAX_TITLE &&
    Number.isInteger(s.minutes) &&
    (s.minutes as number) >= 1 &&
    (s.minutes as number) <= MAX_MINUTES &&
    (STEP_ICONS as readonly unknown[]).includes(s.icon) &&
    (s.href === undefined || (typeof s.href === "string" && s.href.startsWith("/") && !s.href.startsWith("//"))) &&
    typeof s.done === "boolean" &&
    (s.doneAt === undefined || typeof s.doneAt === "string") &&
    (SOURCES as readonly unknown[]).includes(s.source) &&
    (s.stage === undefined || (STAGES as readonly unknown[]).includes(s.stage))
  );
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validEnergy(raw: unknown): raw is Plan["energy"] {
  if (typeof raw !== "object" || raw === null) return false;
  const e = raw as Record<string, unknown>;
  return (ENERGY_LEVELS as readonly unknown[]).includes(e.level) && typeof e.date === "string" && DATE.test(e.date);
}

export function loadPlan(): Plan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return starterPlan();
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.steps)) return starterPlan();
    const plan: Plan = { version: 1, steps: data.steps.filter(validStep) };
    if (validEnergy(data.energy)) plan.energy = data.energy;
    if (typeof data.checkInSkipped === "string" && DATE.test(data.checkInSkipped)) plan.checkInSkipped = data.checkInSkipped;
    if ((STAGES as readonly unknown[]).includes(data.stage)) plan.stage = data.stage;
    if (typeof data.stageOpenedAt === "string" && !Number.isNaN(Date.parse(data.stageOpenedAt))) plan.stageOpenedAt = data.stageOpenedAt;
    if (Array.isArray(data.events)) {
      plan.events = data.events.filter(
        (e: unknown) =>
          typeof e === "object" && e !== null && (PLAN_EVENTS as readonly unknown[]).includes((e as { type: unknown }).type) &&
          typeof (e as { at: unknown }).at === "string",
      );
    }
    const g = data.weekGoal;
    if (g && (STAGES as readonly unknown[]).includes(g.stage) && typeof g.week === "string" && /^\d{4}-W\d{2}$/.test(g.week)) plan.weekGoal = { stage: g.stage, week: g.week };
    if (typeof data.lastHabit === "string" && DATE.test(data.lastHabit)) plan.lastHabit = data.lastHabit;
    return plan;
  } catch {
    return starterPlan();
  }
}

export function savePlan(plan: Plan): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Private mode or blocked storage: the plan keeps working in memory for this visit.
  }
}

// For teammates: add a step from another module, e.g. Jobs adding "Read the job at Acme" to the Apply stage.
// Module steps show first in My plan. A stage that is not one of STAGES is ignored, so the step still lands.
export function addStepToPlan(step: NewStep): void {
  const stage = (STAGES as readonly unknown[]).includes(step.stage) ? step.stage : undefined;
  savePlan(addSteps(loadPlan(), [{ ...step, stage }], "module"));
}

// For teammates: tell My plan that something happened, e.g. markEvent("job-saved") when a job is saved.
// My plan moves the person to the next stage the next time it opens. Unknown events are ignored.
export function markEvent(type: PlanEvent): void {
  if (!(PLAN_EVENTS as readonly unknown[]).includes(type)) return;
  const plan = loadPlan();
  savePlan({ ...plan, events: [...(plan.events ?? []), { type, at: new Date().toISOString() }].slice(-50) });
}
