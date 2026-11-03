import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BRANCH_PREVIEW,
  BRANCH_STEPS,
  activeSteps,
  branchComplete,
  branchProgress,
  currentBranch,
  fillToday,
  isoWeek,
  markEventIn,
  weekGoal,
} from "@/lib/path";
import { BRANCHES, addSteps, completeStep, loadPlan, removeStep, starterPlan, stepKey, type Plan } from "@/lib/plan";

// Thursday 29 October 2026, 10:00 local time
const now = new Date(2026, 9, 29, 10);
const later = (hours: number) => new Date(now.getTime() + hours * 3_600_000);
const keys = (p: Plan) => p.steps.map((s) => stepKey(s.id));
const done = (p: Plan, at: number, ...ids: string[]) => ids.reduce((q, id) => completeStep(q, id, later(at)), p);
const start = () => fillToday(starterPlan(), now);

describe("plans saved before the branches", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) });
  });

  it("keep every step and star, with their stages turned into branches", () => {
    const old = {
      version: 1,
      stage: "apply",
      steps: [
        { id: "starter-profile", title: "Finish your profile", minutes: 3, icon: "user", done: true, doneAt: "2026-10-01T10:00:00.000Z", source: "starter", stage: "ready" },
        { id: "path-resume", title: "Update your resume", minutes: 10, icon: "list", done: true, doneAt: "2026-10-02T10:00:00.000Z", source: "path", stage: "ready" },
        { id: "path-thanks", title: "Write a short thank-you message", minutes: 5, icon: "message", done: false, source: "path", stage: "follow-up" },
        { id: "x", title: "Start: CS50", minutes: 20, icon: "list", href: "/learn", done: false, source: "module", stage: "ready" },
      ],
      weekGoal: { stage: "apply", week: "2026-W44" },
    };
    localStorage.setItem("plan", JSON.stringify(old));
    const plan = fillToday(loadPlan(), now);
    const stageOf = (id: string) => plan.steps.find((s) => s.id === id)?.stage;
    expect([stageOf("starter-profile"), stageOf("path-resume"), stageOf("path-thanks"), stageOf("x")]).toEqual(["setup", "documents", "apply", "learn"]);
    expect(plan.steps.filter((s) => s.done)).toHaveLength(2);
    expect(plan.weekGoal).toEqual({ branch: "apply", week: "2026-W44" });
    // New branches get their steps; the steps that were already there are not added twice.
    expect(keys(plan)).toContain("path-cv");
    expect(keys(plan).filter((k) => k === "path-thanks")).toHaveLength(1);
  });
});

describe("branches", () => {
  it("are all open from the start, each with its own steps", () => {
    const p = start();
    for (const branch of BRANCHES) {
      for (const def of BRANCH_STEPS[branch]) expect(keys(p), def.id).toContain(def.id);
    }
    expect(branchProgress(p, "apply")).toEqual({ done: 0, total: 5 });
  });

  it("do not add back a step the person removed", () => {
    const p = fillToday(removeStep(start(), "path-papers"), later(1));
    expect(keys(p)).not.toContain("path-papers");
  });

  it("count a step broken into smaller ones only when the last small step is done", () => {
    let p = start();
    p = addSteps(removeStep(p, "path-cv"), [{ title: "Open Profile", minutes: 2, stage: "setup" }, { title: "Upload", minutes: 3, stage: "setup" }], "ai");
    p = { ...p, steps: p.steps.map((s) => (s.source === "ai" ? { ...s, id: `path-cv:${s.id}` } : s)) };
    const [a, b] = p.steps.filter((s) => s.id.startsWith("path-cv:"));
    p = done(p, 1, "starter-profile", "path-conditions", "path-wants", a.id);
    expect(branchComplete(p, "setup")).toBe(false);
    expect(branchComplete(done(p, 2, b.id), "setup")).toBe(true);
  });

  it("light the step an event from another module stands for, once", () => {
    let p = markEventIn(start(), "job-saved", later(1));
    p = fillToday(p, later(1));
    expect(p.steps.find((s) => s.id === "starter-save")?.done).toBe(true);
    // The same event does not light the next round's copy too.
    p = fillToday({ ...p, steps: [...p.steps, { ...p.steps.find((s) => s.id === "starter-save")!, id: "starter-save:x", done: false }] }, later(2));
    expect(p.steps.find((s) => s.id === "starter-save:x")?.done).toBe(false);
  });

  it("open a new round of Find jobs and Applications after a reply was checked, keeping the stars", () => {
    const round = [...BRANCH_STEPS.search, ...BRANCH_STEPS.apply].map((d) => d.id);
    const p = fillToday(done(start(), 1, ...round), later(2));
    expect(p.steps.filter((s) => stepKey(s.id) === "path-send")).toHaveLength(2);
    expect(p.steps.filter((s) => s.done && stepKey(s.id) === "path-send")).toHaveLength(1);
    // Only once per reply.
    expect(fillToday(p, later(3)).steps.filter((s) => stepKey(s.id) === "path-send")).toHaveLength(2);
  });
});

describe("today's steps", () => {
  it("come from Constela's order, steps from other modules first", () => {
    let p = start();
    p = addSteps(p, [{ title: "Read the job at Acme", minutes: 5, stage: "apply" }], "module");
    const order = activeSteps(p).filter((s) => !s.done);
    expect(order[0].title).toBe("Read the job at Acme");
    expect(order[1].id).toBe("starter-profile");
    expect(currentBranch({ ...p, steps: p.steps.filter((s) => s.source !== "module") })).toBe("setup");
  });

  it("come from the branch the person chose", () => {
    const p = { ...start(), focus: "interview" as const };
    expect(activeSteps(p).find((s) => !s.done)?.id).toBe("starter-practice");
    expect(currentBranch(p)).toBe("interview");
    const own = addSteps({ ...p, focus: "own" }, [{ title: "Call Ana", minutes: 5 }], "user");
    expect(activeSteps(own).find((s) => !s.done)?.title).toBe("Call Ana");
  });

  it("add the habit twice a week, once a day, replacing an undone copy, and not while setting up", () => {
    const setUp = done(start(), 0, ...BRANCH_STEPS.setup.map((d) => d.id), "starter-jobs");
    const monday = new Date(2026, 10, 2, 9);
    const p1 = fillToday(setUp, monday);
    expect(p1.steps.filter((s) => s.source === "habit")).toHaveLength(1);
    expect(fillToday(p1, monday).steps.filter((s) => s.source === "habit")).toHaveLength(1);
    const p2 = fillToday(p1, new Date(2026, 10, 5, 9)); // Thursday
    expect(p2.steps.filter((s) => s.source === "habit" && !s.done)).toHaveLength(1);
    expect(fillToday(start(), monday).steps.some((s) => s.source === "habit")).toBe(false);
  });
});

describe("weekly goal", () => {
  it("uses ISO weeks", () => {
    expect(isoWeek(new Date(2026, 9, 29))).toBe("2026-W44");
    expect(isoWeek(new Date(2027, 0, 1))).toBe("2026-W53");
  });

  it("comes from the branch being worked on, and keeps it for the week", () => {
    const first = weekGoal(start(), now);
    expect(first.text).toBe("This week: choose what you want in a job");
    const moved = weekGoal({ ...first.plan, focus: "learn" }, now);
    expect(moved.text).toBe(first.text);
    expect(weekGoal(done(first.plan, 1, "path-wants"), now).met).toBe(true);
  });
});

describe("branch previews", () => {
  it("describe every branch in short, calm Easy Read", () => {
    for (const text of Object.values(BRANCH_PREVIEW)) {
      expect(text.split(". ").length).toBeLessThanOrEqual(3);
      expect(text).not.toMatch(/!/);
    }
    expect(Object.keys(BRANCH_PREVIEW)).toHaveLength(BRANCHES.length);
  });
});

describe("a simulated week", () => {
  it("always has a step ready, adds habits only on Monday and Thursday, and keeps one goal", () => {
    let p = fillToday(starterPlan(), new Date(2026, 10, 2, 8));
    const goals = new Set<string>();
    for (let day = 2; day <= 8; day++) {
      const morning = new Date(2026, 10, day, 9);
      p = fillToday(p, morning);
      const waiting = activeSteps(p).filter((s) => !s.done);
      expect(waiting.length).toBeGreaterThan(0);
      const goal = weekGoal(p, morning);
      p = goal.plan;
      goals.add(goal.text);
      for (const step of waiting.slice(0, 2)) p = completeStep(p, step.id, new Date(2026, 10, day, 10));
    }
    const habitDays = p.steps.filter((s) => s.source === "habit").map((s) => s.id.slice(-2));
    expect(habitDays.every((d) => d === "02" || d === "05")).toBe(true);
    expect(goals.size).toBe(1);
    expect(branchComplete(p, "setup")).toBe(true);
  });
});
