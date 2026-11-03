// The job search map: its branches, their steps, how events from other modules light steps, and today's steps.
// Every branch is open at once; the person can choose which one to work on, and Constela still suggests one step at
// a time. Everything here is pure and takes `now`, so it can be tested with fixed dates.
import {
  BRANCHES,
  STARTER_STEPS,
  completesItself,
  localDate,
  stepKey,
  type Branch,
  type Plan,
  type PlanEvent,
  type PlanStep,
} from "@/lib/plan";

export const BRANCH_NAMES: Record<Branch, string> = {
  setup: "Set up your profile",
  search: "Find jobs",
  apply: "Applications and follow-up",
  interview: "Interview prep",
  documents: "Documents and references",
  learn: "Learn and prepare",
  experience: "Experience and portfolio",
};
// Steps the person added, and the small steps "Break it down for me" made from them.
export const OWN_NAME = "Your own steps";
export const branchName = (b: Branch | "own") => (b === "own" ? OWN_NAME : BRANCH_NAMES[b]);

// What each branch is for, in 1 or 2 Easy Read sentences: in All branches, and when a branch is finished.
export const BRANCH_PREVIEW: Record<Branch, string> = {
  setup: "You tell Constela what helps you and what to watch for, and add your CV. Then everything fits you better.",
  search: "You look at jobs and internships picked for you and save the ones you like. Nothing is sent to anyone.",
  apply: "You read about the company, send an application when you choose, and follow up. Waiting a few days for a reply is normal.",
  interview: "You practice questions, learn what an interview day is like, and plan how to get there.",
  documents: "You get your resume, a short cover letter, a reference and your papers ready, so applying is quick.",
  learn: "You find a course or guide for what jobs ask, and start it at your own pace.",
  experience: "You collect things you made or did, from school, work or home, so you can show them. An internship or volunteering counts.",
};

type StepDef = Omit<PlanStep, "done" | "source" | "doneAt">;
const starter = (id: string) => STARTER_STEPS.find((s) => s.id === id)!;

// Each branch's steps, in order. Starter and earlier path steps keep their ids, so saved plans keep their stars.
export const BRANCH_STEPS: Record<Branch, readonly StepDef[]> = {
  setup: [
    starter("starter-profile"),
    { id: "path-conditions", title: "Choose what to watch for in a job", minutes: 5, icon: "list", href: "/profile", stage: "setup" },
    { id: "path-wants", title: "Choose 3 things you want in a job", minutes: 5, icon: "list", stage: "setup" },
    { id: "path-cv", title: "Add your CV", minutes: 5, icon: "user", href: "/profile", stage: "setup" },
  ],
  search: [
    starter("starter-jobs"),
    starter("starter-save"),
    { id: "path-internships", title: "Look at internships", minutes: 10, icon: "briefcase", href: "/jobs?tab=internships", stage: "search" },
  ],
  apply: [
    starter("starter-company"),
    { id: "path-questions", title: "Write 2 questions to ask them", minutes: 5, icon: "message", stage: "apply" },
    { id: "path-send", title: "Send your application", minutes: 10, icon: "briefcase", href: "/jobs?tab=saved", stage: "apply" },
    { id: "path-thanks", title: "Write a short thank-you message", minutes: 5, icon: "message", stage: "apply" },
    { id: "path-reply", title: "Check your email for a reply", minutes: 2, icon: "list", stage: "apply" },
  ],
  interview: [
    starter("starter-practice"),
    starter("starter-expect"),
    { id: "path-route", title: "Plan how to get there", minutes: 5, icon: "calendar", stage: "interview" },
  ],
  documents: [
    { id: "path-resume", title: "Update your resume", minutes: 10, icon: "list", href: "/profile", stage: "documents" },
    { id: "path-cover", title: "Write a short cover letter for a saved job", minutes: 15, icon: "message", href: "/jobs?tab=saved", stage: "documents" },
    { id: "path-reference", title: "Ask one person to be a reference", minutes: 5, icon: "user", stage: "documents" },
    { id: "path-papers", title: "Get your ID and work papers ready", minutes: 10, icon: "list", stage: "documents" },
  ],
  learn: [
    { id: "path-learn-look", title: "Look at courses for your saved jobs", minutes: 5, icon: "list", href: "/learn", stage: "learn" },
    { id: "path-learn-start", title: "Start one course or guide", minutes: 20, icon: "list", href: "/learn", stage: "learn" },
  ],
  experience: [
    { id: "path-made", title: "Write down one thing you made or did", minutes: 10, icon: "list", stage: "experience" },
    { id: "path-portfolio", title: "Put one project where employers can see it", minutes: 20, icon: "list", stage: "experience" },
    { id: "path-volunteer", title: "Find one internship or volunteer role", minutes: 10, icon: "briefcase", href: "/jobs?tab=internships", stage: "experience" },
  ],
};

// The branch Constela suggests when the person has not chosen one: what most job searches need first.
export const PRIORITY: readonly Branch[] = ["setup", "search", "apply", "documents", "interview", "learn", "experience"];

// Events from other modules light the step they stand for: saving a job lights "Save one job you like".
const EVENT_STEP: Record<PlanEvent, string> = { "job-saved": "starter-save", "application-sent": "path-send", "practice-done": "starter-practice" };

// A kind counts once it is done and no copy of it is still waiting. That way a step broken down into smaller ones
// (which share its kind) only counts when the last small step is done.
function kindDone(steps: PlanStep[], key: string, since?: string): boolean {
  const same = steps.filter((s) => stepKey(s.id) === key);
  return same.some((s) => s.done && (!since || (s.doneAt ?? "") >= since)) && !same.some((s) => !s.done);
}

export function branchProgress(plan: Plan, branch: Branch): { done: number; total: number } {
  const kinds = BRANCH_STEPS[branch].map((d) => d.id);
  return { done: kinds.filter((k) => kindDone(plan.steps, k)).length, total: kinds.length };
}

export function branchComplete(plan: Plan, branch: Branch): boolean {
  const { done, total } = branchProgress(plan, branch);
  return total > 0 && done === total;
}

// Adds each branch's steps once. A step the person removed is not added back: `opened` remembers what was added.
// Plans from before the branches count what they already have as added, and get the new branches' steps.
function openBranches(plan: Plan): Plan {
  const opened = new Set(plan.opened ?? plan.steps.map((s) => stepKey(s.id)));
  const steps = [...plan.steps];
  for (const branch of BRANCHES) {
    for (const def of BRANCH_STEPS[branch]) {
      if (opened.has(def.id)) continue;
      opened.add(def.id);
      // The profile is finished once; it is never asked for again.
      if (completesItself(def.id) && steps.some((s) => s.done && stepKey(s.id) === def.id)) continue;
      steps.push({ ...def, done: false, source: "path" });
    }
  }
  return { ...plan, steps, opened: [...opened] };
}

// Lights the step behind each event that happened since the last look. One event lights one waiting step.
function lightEvents(plan: Plan): Plan {
  const fresh = (plan.events ?? []).filter((e) => !plan.eventsSeen || e.at > plan.eventsSeen);
  if (!fresh.length) return plan;
  let steps = plan.steps;
  for (const e of fresh) {
    const i = steps.findIndex((s) => !s.done && stepKey(s.id) === EVENT_STEP[e.type]);
    if (i >= 0) steps = steps.map((s, j) => (j === i ? { ...s, done: true, doneAt: e.at } : s));
  }
  return { ...plan, steps, eventsSeen: fresh.reduce((latest, e) => (e.at > latest ? e.at : latest), plan.eventsSeen ?? "") };
}

// Applying is a cycle: when a reply was checked and nothing is left to do in Find jobs or Applications, a new round
// of both opens, for the next job. Earlier rounds keep their lit stars.
function nextRound(plan: Plan, now: Date): Plan {
  const roundKinds = new Set([...BRANCH_STEPS.search, ...BRANCH_STEPS.apply].map((d) => d.id));
  const waiting = plan.steps.some((s) => !s.done && roundKinds.has(stepKey(s.id)));
  const replied = plan.steps.some((s) => s.done && stepKey(s.id) === "path-reply" && (s.doneAt ?? "") > (plan.roundAt ?? ""));
  if (waiting || !replied) return plan;
  const suffix = now.getTime().toString(36);
  const round = [...BRANCH_STEPS.search, ...BRANCH_STEPS.apply].map((def) => ({ ...def, id: `${def.id}:${suffix}`, done: false, source: "path" as const }));
  return { ...plan, steps: [...plan.steps, ...round], roundAt: now.toISOString() };
}

// The order branches are worked in: the person's choice first, then Constela's.
export function branchOrder(plan: Plan): Array<Branch | "own"> {
  const all: Array<Branch | "own"> = [...PRIORITY, "own"];
  return plan.focus ? [plan.focus, ...all.filter((b) => b !== plan.focus)] : all;
}

// Every step, in the order to work on them. Steps from other modules come first: they are the most concrete.
export function activeSteps(plan: Plan): PlanStep[] {
  const order = branchOrder(plan);
  const rank = (s: PlanStep) => order.indexOf(s.stage ?? "own");
  const modules = plan.steps.filter((s) => s.source === "module");
  const rest = plan.steps.map((s, i) => [s, i] as const).filter(([s]) => s.source !== "module");
  rest.sort(([a, i], [b, j]) => rank(a) - rank(b) || i - j);
  return [...modules, ...rest.map(([s]) => s)];
}

// The branch of the next step to do, or undefined when everything is done.
export function currentBranch(plan: Plan): Branch | "own" | undefined {
  const next = activeSteps(plan).find((s) => !s.done);
  return next ? (next.stage ?? "own") : undefined;
}

const HABIT_ID = "habit-jobs";
const HABIT_DAYS = [1, 4]; // Monday and Thursday: twice a week, never daily

// Today's plan: add the branches' steps, light steps for what happened, open a new round, and add a due habit once.
export function fillToday(plan: Plan, now: Date): Plan {
  let p = nextRound(lightEvents(openBranches(plan)), now);
  const today = localDate(now);
  const lookingAnyway = p.steps.some((s) => !s.done && stepKey(s.id) === "starter-jobs");
  // No habit while the profile is still being set up: one new thing at a time.
  if (branchComplete(p, "setup") && HABIT_DAYS.includes(now.getDay()) && p.lastHabit !== today && !lookingAnyway) {
    // A habit replaces its last undone copy; it never stacks up.
    const steps = p.steps.filter((s) => !(stepKey(s.id) === HABIT_ID && !s.done));
    steps.push({ id: `${HABIT_ID}:${today}`, title: "Look at new jobs", minutes: 5, icon: "briefcase", href: "/jobs", done: false, source: "habit", stage: "search" });
    p = { ...p, steps, lastHabit: today };
  }
  return p;
}

export function markEventIn(plan: Plan, type: PlanEvent, now: Date): Plan {
  const events = [...(plan.events ?? []), { type, at: now.toISOString() }].slice(-50);
  return { ...plan, events };
}

// ---- Weekly goal: one small goal per week, from the branch being worked on when the week started. No "missed". ----

type Check = { done: (key: string) => boolean; happened: (e: PlanEvent) => boolean };
const GOALS: Record<Branch, { text: string; met: (c: Check) => boolean }> = {
  setup: { text: "This week: choose what you want in a job", met: (c) => c.done("path-wants") },
  search: { text: "This week: save 1 job", met: (c) => c.done("starter-save") || c.happened("job-saved") },
  apply: { text: "This week: send 1 application", met: (c) => c.done("path-send") || c.happened("application-sent") },
  interview: { text: "This week: practice 1 interview question", met: (c) => c.done("starter-practice") || c.happened("practice-done") },
  documents: { text: "This week: update your resume", met: (c) => c.done("path-resume") },
  learn: { text: "This week: start one course or guide", met: (c) => c.done("path-learn-start") },
  experience: { text: "This week: write down one thing you made or did", met: (c) => c.done("path-made") },
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
  const working = currentBranch(plan);
  const branch = plan.weekGoal?.week === week ? plan.weekGoal.branch : working && working !== "own" ? working : PRIORITY.find((b) => !branchComplete(plan, b)) ?? "search";
  const p = plan.weekGoal?.week === week ? plan : { ...plan, weekGoal: { branch, week } };
  const since = weekStart(now);
  const check: Check = {
    done: (key) => kindDone(p.steps, key, since),
    happened: (e) => (p.events ?? []).some((x) => x.type === e && x.at >= since),
  };
  const goal = GOALS[p.weekGoal!.branch];
  return { plan: p, text: goal.text, met: goal.met(check) };
}
