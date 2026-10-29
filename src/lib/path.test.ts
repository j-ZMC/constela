import { beforeEach, describe, expect, it, vi } from "vitest";
import { activeSteps, advance, fillToday, goBack, isoWeek, markEventIn, stageComplete, stageOf, weekGoal } from "@/lib/path";
import { completeStep, loadPlan, removeStep, starterPlan, stepKey, type Plan } from "@/lib/plan";

// Thursday 29 October 2026, 10:00 local time
const now = new Date(2026, 9, 29, 10);
const later = (hours: number) => new Date(now.getTime() + hours * 3_600_000);
const keys = (p: Plan) => p.steps.map((s) => stepKey(s.id));
// Marks steps done at a given hour after `now`, so tests control what happened since a stage opened.
const done = (p: Plan, at: number, ...ids: string[]) => ids.reduce((q, id) => completeStep(q, id, later(at)), p);

describe("migration of plans saved before the path", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) });
  });

  it("loads a plan saved by today's app without losing steps, and gives starter steps a stage", () => {
    const saved = { version: 1, steps: starterPlan().steps.map((s) => ({ ...s, stage: undefined })), energy: { level: "okay", date: "2026-10-29" } };
    localStorage.setItem("plan", JSON.stringify(saved));
    const plan = advance(loadPlan(), now);
    expect(stageOf(plan)).toBe("ready");
    expect(keys(plan)).toEqual(expect.arrayContaining(saved.steps.map((s) => s.id)));
    expect(plan.steps.find((s) => s.id === "starter-jobs")?.stage).toBe("search");
    expect(keys(plan)).toContain("path-wants");
  });

  it("starts at the first stage the person has not finished yet", () => {
    const old = done({ version: 1, steps: starterPlan().steps }, 0, "starter-profile", "starter-jobs", "starter-save");
    const plan = advance(old, now);
    // Get ready still needs "Choose 3 things you want in a job", so old progress does not skip it.
    expect(stageOf(plan)).toBe("ready");
    const ready = advance(done(plan, 1, "path-wants"), later(2));
    expect(stageOf(ready)).toBe("apply");
  });
});

describe("stage progression", () => {
  const start = () => advance(starterPlan(), now);

  it("opens the next stage once its rule is met, adding its steps once", () => {
    const plan = advance(done(start(), 1, "starter-profile", "path-wants"), later(2));
    expect(stageOf(plan)).toBe("search");
    expect(keys(plan).filter((k) => k === "starter-jobs")).toHaveLength(1);
  });

  it("lets an event from another module complete a stage", () => {
    const search = advance(done(start(), 1, "starter-profile", "path-wants"), later(2));
    const saved = advance(markEventIn(search, "job-saved", later(3)), later(3));
    expect(stageOf(saved)).toBe("apply");
  });

  it("only counts events and steps since the stage opened", () => {
    const early = markEventIn(start(), "job-saved", now);
    const search = advance(done(early, 1, "starter-profile", "path-wants"), later(2));
    expect(stageOf(search)).toBe("search");
    expect(stageComplete(search)).toBe(false);
  });

  it("loops from Follow up back to Look for jobs with fresh steps, keeping the earned stars", () => {
    let p = start();
    p = advance(done(p, 1, "starter-profile", "path-wants"), later(2));
    p = advance(done(p, 3, "starter-jobs", "starter-save"), later(3));
    p = advance(markEventIn(p, "application-sent", later(4)), later(4));
    p = advance(done(markEventIn(p, "practice-done", later(5)), 5, "starter-expect"), later(6));
    expect(stageOf(p)).toBe("follow-up");
    p = advance(done(p, 7, "path-thanks", "path-reply"), later(7));
    expect(stageOf(p)).toBe("search");
    const jobs = p.steps.filter((s) => stepKey(s.id) === "starter-jobs");
    expect(jobs.map((s) => s.done)).toEqual([true, false]);
  });

  it("going back keeps done steps and does not ask for the profile again", () => {
    let p = advance(done(start(), 1, "starter-profile", "path-wants"), later(2));
    p = goBack(p, "ready", later(3));
    expect(stageOf(p)).toBe("ready");
    expect(p.steps.filter((s) => s.done).map((s) => s.id)).toEqual(["starter-profile", "path-wants"]);
    expect(keys(p).filter((k) => k === "starter-profile")).toHaveLength(1);
  });
});

describe("today's steps", () => {
  it("hides later stages and shows steps from other modules first", () => {
    const p = advance(starterPlan(), now);
    const moduleStep = { id: "m", title: "Read the job at Acme", minutes: 5, icon: "briefcase" as const, done: false, source: "module" as const };
    const shown = activeSteps({ ...p, steps: [...p.steps, moduleStep] });
    expect(shown[0].id).toBe("m");
    expect(shown.some((s) => s.stage === "search")).toBe(false);
  });

  it("never leaves the screen empty while a stage is open", () => {
    let p = advance(starterPlan(), now);
    for (const s of activeSteps(p)) p = removeStep(p, s.id);
    p = fillToday(p, later(1));
    expect(activeSteps(p).some((s) => !s.done)).toBe(true);
  });

  it("adds the habit twice a week, once a day, replacing an undone copy", () => {
    let p = advance(done(advance(starterPlan(), now), 0, "starter-profile", "path-wants"), later(1));
    p = advance(done(p, 2, "starter-jobs", "starter-save"), later(2)); // now in Apply
    const habits = (q: Plan) => q.steps.filter((s) => s.source === "habit");
    p = fillToday(p, now); // Thursday
    expect(habits(p)).toHaveLength(1);
    expect(habits(fillToday(p, later(3)))).toHaveLength(1); // same day: no second copy
    expect(habits(fillToday(p, new Date(2026, 9, 30, 10))).filter((s) => s.id.endsWith("10-30"))).toHaveLength(0); // Friday
    const monday = fillToday(p, new Date(2026, 10, 2, 10));
    expect(habits(monday).map((s) => s.id)).toEqual(["habit-jobs:2026-11-02"]);
  });

  it("adds no habit while getting ready", () => {
    expect(fillToday(starterPlan(), now).steps.some((s) => s.source === "habit")).toBe(false);
  });
});

describe("weekly goal", () => {
  it("uses ISO weeks", () => {
    expect(isoWeek(now)).toBe("2026-W44");
    expect(isoWeek(new Date(2026, 0, 1))).toBe("2026-W01");
    expect(isoWeek(new Date(2027, 0, 1))).toBe("2026-W53");
  });

  it("keeps the week's goal even if the stage moves on, and counts only this week", () => {
    const p = advance(starterPlan(), now);
    const first = weekGoal(p, now);
    expect(first.text).toBe("This week: choose what you want in a job");
    expect(first.met).toBe(false);
    const moved = advance(done(first.plan, 1, "starter-profile", "path-wants"), later(1));
    const same = weekGoal(moved, later(1));
    expect(same.text).toBe(first.text);
    expect(same.met).toBe(true);
    const nextWeek = weekGoal(same.plan, new Date(2026, 10, 3, 10));
    expect(nextWeek.text).toBe("This week: save 1 job");
    expect(nextWeek.met).toBe(false);
  });
});
