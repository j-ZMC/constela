// The job search path: stages, what each stage asks for, how the plan moves on, and today's steps.
// See SPEC-path.md. Everything here is pure and takes `now`, so it can be tested with fixed dates.
import {
  STAGES,
  STARTER_STEPS,
  completesItself,
  localDate,
  stepKey,
  type Plan,
  type PlanEvent,
  type PlanStep,
  type Stage,
} from "@/lib/plan";

export const STAGE_NAMES: Record<Stage, string> = {
  ready: "Get ready",
  search: "Look for jobs",
  apply: "Apply",
  interview: "Prepare for the interview",
  "follow-up": "Follow up",
};

type StepDef = Omit<PlanStep, "done" | "source" | "doneAt">;

const starter = (id: string) => STARTER_STEPS.find((s) => s.id === id)!;

// Each stage's steps, in order. Starter steps keep their ids so plans saved before the path keep their stars.
export const STAGE_STEPS: Record<Stage, readonly StepDef[]> = {
  ready: [
    starter("starter-profile"),
    { id: "path-wants", title: "Choose 3 things you want in a job", minutes: 5, icon: "list", stage: "ready" },
    { id: "path-resume", title: "Update your resume", minutes: 10, icon: "list", stage: "ready" },
  ],
  search: [starter("starter-jobs"), starter("starter-save")],
  apply: [
    starter("starter-company"),
    { id: "path-questions", title: "Write 2 questions to ask them", minutes: 5, icon: "message", stage: "apply" },
    { id: "path-send", title: "Send your application", minutes: 10, icon: "briefcase", href: "/jobs", stage: "apply" },
  ],
  interview: [
    starter("starter-practice"),
    starter("starter-expect"),
    { id: "path-route", title: "Plan how to get there", minutes: 5, icon: "calendar", stage: "interview" },
  ],
  "follow-up": [
    { id: "path-thanks", title: "Write a short thank-you message", minutes: 5, icon: "message", stage: "follow-up" },
    { id: "path-reply", title: "Check your email for a reply", minutes: 2, icon: "list", stage: "follow-up" },
  ],
};

// "Done when", from SPEC-path.md. `c` only counts what happened since the stage opened; `all` counts everything
// (a profile is finished once, not every round).
type Check = { done: (key: string) => boolean; happened: (e: PlanEvent) => boolean };
const RULES: Record<Stage, (c: Check, all: Check) => boolean> = {
  ready: (c, all) => all.done("starter-profile") && c.done("path-wants"),
  search: (c) => c.done("starter-save") || c.happened("job-saved"),
  apply: (c) => c.done("path-send") || c.happened("application-sent"),
  interview: (c) => (c.done("starter-practice") || c.happened("practice-done")) && c.done("starter-expect"),
  "follow-up": (c) => c.done("path-thanks") && c.done("path-reply"),
};

// Applying is a cycle: after Follow up, the person looks for the next job.
export function nextStage(stage: Stage): Stage {
  return stage === "follow-up" ? "search" : STAGES[STAGES.indexOf(stage) + 1];
}

export function stageOf(plan: Plan): Stage {
  return plan.stage ?? "ready";
}

function checker(plan: Plan, since?: string): Check {
  const after = (at?: string) => !since || (at !== undefined && at >= since);
  return {
    // A step marked done without a date (the profile step syncs that way) only counts for plans that predate the path.
    done: (key) => plan.steps.some((s) => s.done && stepKey(s.id) === key && (since ? after(s.doneAt) : true)),
    happened: (e) => (plan.events ?? []).some((x) => x.type === e && after(x.at)),
  };
}

export function stageComplete(plan: Plan, stage = stageOf(plan)): boolean {
  return RULES[stage](checker(plan, plan.stageOpenedAt), checker(plan));
}

// Adds the stage's steps that are not already waiting in the plan. A kind done in an earlier round gets a fresh id.
function openStage(plan: Plan, stage: Stage, now: Date): Plan {
  const steps = [...plan.steps];
  for (const def of STAGE_STEPS[stage]) {
    if (steps.some((s) => !s.done && stepKey(s.id) === def.id)) continue;
    // The profile is finished once; going back to Get ready does not ask for it again.
    if (completesItself(def.id) && steps.some((s) => s.done && stepKey(s.id) === def.id)) continue;
    const taken = steps.some((s) => s.id === def.id);
    steps.push({ ...def, id: taken ? `${def.id}:${now.getTime().toString(36)}` : def.id, done: false, source: "path" });
  }
  return { ...plan, steps, stage, stageOpenedAt: now.toISOString() };
}

// Plans saved before the path have no stage: start them at the first stage they have not finished, counting everything.
function migrate(plan: Plan, now: Date): Plan {
  if (plan.stage) return plan;
  const steps = plan.steps.map((s) => {
    const def = STARTER_STEPS.find((d) => d.id === stepKey(s.id));
    return s.stage || !def?.stage ? s : { ...s, stage: def.stage };
  });
  // A brand-new plan has no history to honor: it simply opens Get ready.
  if (!steps.some((s) => s.done) && !plan.events?.length) return openStage({ ...plan, steps }, "ready", now);
  const all = checker(plan);
  const stage = STAGES.find((s) => !RULES[s](all, all)) ?? "follow-up";
  const opened = openStage({ ...plan, steps }, stage, now);
  // Keep counting everything for this first stage, so old progress is not ignored.
  return { ...opened, stageOpenedAt: undefined };
}

// Moves on through every stage whose rule is already met (an event can finish a stage at once).
export function advance(plan: Plan, now: Date): Plan {
  let p = migrate(plan, now);
  for (let i = 0; i < STAGES.length && stageComplete(p); i++) {
    const next = nextStage(stageOf(p));
    // Old plans: a later stage the person already did before the path existed is skipped, not repeated.
    const all = checker(p);
    if (!p.stageOpenedAt && STAGES.indexOf(next) > STAGES.indexOf(stageOf(p)) && RULES[next](all, all)) {
      p = { ...p, stage: next };
      continue;
    }
    p = openStage(p, next, now);
  }
  return p;
}

// The person can go back, for example after a "no" from an employer. Done steps stay done: stars are never taken away.
export function goBack(plan: Plan, stage: Stage, now: Date): Plan {
  return openStage(plan, stage, now);
}

export function markEventIn(plan: Plan, type: PlanEvent, now: Date): Plan {
  const events = [...(plan.events ?? []), { type, at: now.toISOString() }].slice(-50);
  return { ...plan, events };
}

// Which steps belong on screen now: the current stage and earlier ones, plus steps with no stage.
// Steps of a later stage wait until it opens. Steps from other modules come first: they are the most concrete.
export function activeSteps(plan: Plan): PlanStep[] {
  const at = STAGES.indexOf(stageOf(plan));
  const shown = plan.steps.filter((s) => !s.stage || STAGES.indexOf(s.stage) <= at);
  return [...shown.filter((s) => s.source === "module"), ...shown.filter((s) => s.source !== "module")];
}

const HABIT_ID = "habit-jobs";
const HABIT_DAYS = [1, 4]; // Monday and Thursday: twice a week, never daily

// Today's plan: migrate, move on if a stage is done, keep at least one step ready, and add a due habit once.
export function fillToday(plan: Plan, now: Date): Plan {
  let p = advance(plan, now);
  const stage = stageOf(p);
  // Someone who removed every step of the stage still gets a way forward: never an empty screen.
  if (!activeSteps(p).some((s) => !s.done)) p = openStage(p, stage, now);

  const today = localDate(now);
  const lookingAnyway = p.steps.some((s) => !s.done && stepKey(s.id) === "starter-jobs");
  if (stage !== "ready" && HABIT_DAYS.includes(now.getDay()) && p.lastHabit !== today && !lookingAnyway) {
    // A habit replaces its last undone copy; it never stacks up.
    const steps = p.steps.filter((s) => !(stepKey(s.id) === HABIT_ID && !s.done));
    steps.push({ id: `${HABIT_ID}:${today}`, title: "Look at new jobs", minutes: 5, icon: "briefcase", href: "/jobs", done: false, source: "habit" });
    p = { ...p, steps, lastHabit: today };
  }
  return p;
}

// ---- Weekly goal: one small goal per week, from the stage the week started in. No "missed" state. ----

const GOALS: Record<Stage, { text: string; met: (c: Check) => boolean }> = {
  ready: { text: "This week: choose what you want in a job", met: (c) => c.done("path-wants") },
  search: { text: "This week: save 1 job", met: (c) => c.done("starter-save") || c.happened("job-saved") },
  apply: { text: "This week: send 1 application", met: (c) => c.done("path-send") || c.happened("application-sent") },
  interview: { text: "This week: practice 1 interview question", met: (c) => c.done("starter-practice") || c.happened("practice-done") },
  "follow-up": { text: "This week: send 1 thank-you message", met: (c) => c.done("path-thanks") },
};

// ISO week, YYYY-Www, from the person's own calendar day.
export function isoWeek(now: Date): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekStart(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
}

// Returns the plan (with this week's goal stored) and the goal to show.
export function weekGoal(plan: Plan, now: Date): { plan: Plan; text: string; met: boolean } {
  const week = isoWeek(now);
  const p = plan.weekGoal?.week === week ? plan : { ...plan, weekGoal: { stage: stageOf(plan), week } };
  const goal = GOALS[p.weekGoal!.stage];
  return { plan: p, text: goal.text, met: goal.met(checker(p, weekStart(now))) };
}
