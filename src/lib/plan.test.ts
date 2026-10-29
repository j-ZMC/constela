import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ADAPTATIONS, type Adaptations } from "@/lib/profile";
import {
  ENERGY_LEVELS,
  STARTER_STEPS,
  gentleTone,
  addStepToPlan,
  addSteps,
  markEvent,
  checkInDue,
  completeStep,
  localDate,
  resetCheckIn,
  setEnergy,
  todayEnergy,
  undoStep,
  loadPlan,
  removeStep,
  savePlan,
  starterPlan,
  syncWithProfile,
  visibleSteps,
  type Plan,
} from "@/lib/plan";

const one: Adaptations = { ...DEFAULT_ADAPTATIONS, stepsAtOnce: 1 };

describe("starter path", () => {
  it("has the 6 steps from the spec, all undone and linked to a module", () => {
    expect(STARTER_STEPS).toHaveLength(6);
    const plan = starterPlan();
    expect(plan.steps.every((s) => !s.done && s.source === "starter" && s.href?.startsWith("/"))).toBe(true);
  });

  it("marks the profile step done when a profile exists", () => {
    const plan = syncWithProfile(starterPlan(), true);
    expect(plan.steps[0].done).toBe(true);
    expect(syncWithProfile(starterPlan(), false).steps[0].done).toBe(false);
  });
});

describe("visibleSteps", () => {
  it("shows 3 undone steps by default and 1 with stepsAtOnce: 1", () => {
    const plan = starterPlan();
    expect(visibleSteps(plan, DEFAULT_ADAPTATIONS)).toHaveLength(3);
    expect(visibleSteps(plan, one)).toHaveLength(1);
  });

  it("skips done steps", () => {
    const plan = completeStep(starterPlan(), STARTER_STEPS[0].id, new Date("2026-10-27T10:00:00Z"));
    expect(visibleSteps(plan, one)[0].id).toBe(STARTER_STEPS[1].id);
  });

  it("on low energy shows one step of 5 minutes or less, in path order", () => {
    // Starter step 2 takes 10 minutes, step 3 takes 2.
    const plan = completeStep(starterPlan(), STARTER_STEPS[0].id, new Date());
    const steps = visibleSteps(plan, DEFAULT_ADAPTATIONS, "low");
    expect(steps).toHaveLength(1);
    expect(steps[0].minutes).toBeLessThanOrEqual(5);
  });

  it("on low energy falls back to the next step when none is short", () => {
    const plan: Plan = { version: 1, steps: [{ ...starterPlan().steps[1], id: "long" }] };
    expect(visibleSteps(plan, DEFAULT_ADAPTATIONS, "low").map((s) => s.id)).toEqual(["long"]);
  });

  it("when stressed shows only the shortest step that is ready", () => {
    const steps = visibleSteps(starterPlan(), DEFAULT_ADAPTATIONS, "stressed");
    expect(steps.map((s) => s.id)).toEqual(["starter-profile"]);
  });

  it("never offers a step before the one it needs", () => {
    const plan = completeStep(starterPlan(), "starter-profile", new Date());
    // "Save one job" (2 min) needs "Look at 3 jobs" (10 min) first.
    expect(visibleSteps(plan, DEFAULT_ADAPTATIONS, "low")[0].id).toBe("starter-practice");
    expect(visibleSteps(plan, DEFAULT_ADAPTATIONS, "stressed")[0].id).toBe("starter-practice");
    const looked = completeStep(plan, "starter-jobs", new Date());
    expect(visibleSteps(looked, DEFAULT_ADAPTATIONS, "stressed")[0].id).toBe("starter-save");
  });

  it("asks the AI for a gentle tone only after low energy or stress", () => {
    expect([undefined, ...ENERGY_LEVELS].map(gentleTone)).toEqual([false, true, true, false, false]);
  });

  it("uses the profile setting for okay and good energy", () => {
    expect(visibleSteps(starterPlan(), DEFAULT_ADAPTATIONS, "okay")).toHaveLength(3);
    expect(visibleSteps(starterPlan(), one, "good")).toHaveLength(1);
  });

  it("returns nothing when every step is done", () => {
    const plan = STARTER_STEPS.reduce((p, s) => completeStep(p, s.id, new Date()), starterPlan());
    expect(visibleSteps(plan, DEFAULT_ADAPTATIONS)).toEqual([]);
  });
});

describe("plan edits", () => {
  it("completeStep records the time and leaves other steps alone", () => {
    const plan = completeStep(starterPlan(), STARTER_STEPS[1].id, new Date("2026-10-27T10:00:00Z"));
    const step = plan.steps.find((s) => s.id === STARTER_STEPS[1].id)!;
    expect(step.done).toBe(true);
    expect(step.doneAt).toBe("2026-10-27T10:00:00.000Z");
    expect(plan.steps.filter((s) => s.done)).toHaveLength(1);
  });

  it("addSteps appends by default and inserts after a given step", () => {
    const base = starterPlan();
    const appended = addSteps(base, [{ title: "Call Ana", minutes: 5 }], "user");
    expect(appended.steps.at(-1)).toMatchObject({ title: "Call Ana", minutes: 5, source: "user", done: false });

    const inserted = addSteps(base, [{ title: "A", minutes: 2 }, { title: "B", minutes: 3 }], "ai", STARTER_STEPS[1].id);
    expect(inserted.steps.slice(2, 4).map((s) => s.title)).toEqual(["A", "B"]);
    expect(new Set(inserted.steps.map((s) => s.id)).size).toBe(inserted.steps.length);
  });

  it("addSteps clamps minutes and trims titles", () => {
    const plan = addSteps(starterPlan(), [{ title: "  Tidy desk  ", minutes: 500 }], "user");
    expect(plan.steps.at(-1)).toMatchObject({ title: "Tidy desk", minutes: 60 });
  });

  it("removeStep drops only that step", () => {
    const plan = removeStep(starterPlan(), STARTER_STEPS[2].id);
    expect(plan.steps).toHaveLength(5);
    expect(plan.steps.some((s) => s.id === STARTER_STEPS[2].id)).toBe(false);
  });
});

describe("loadPlan / savePlan", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });
  });

  it("returns the starter path when nothing is saved", () => {
    expect(loadPlan().steps.map((s) => s.id)).toEqual(STARTER_STEPS.map((s) => s.id));
  });

  it("round-trips a plan", () => {
    const plan = completeStep(starterPlan(), STARTER_STEPS[0].id, new Date("2026-10-27T10:00:00Z"));
    savePlan(plan);
    expect(loadPlan()).toEqual(plan);
  });

  it.each([
    ["broken JSON", "{nope"],
    ["an unknown version", JSON.stringify({ version: 7, steps: [] })],
    ["steps that are not an array", JSON.stringify({ version: 1, steps: "x" })],
  ])("falls back to the starter path for %s", (_, raw) => {
    store.plan = raw;
    expect(loadPlan().steps).toHaveLength(6);
  });

  it("drops invalid steps, including unsafe links", () => {
    const good = starterPlan().steps[0];
    store.plan = JSON.stringify({
      version: 1,
      steps: [
        good,
        { ...good, id: "bad-link", href: "javascript:alert(1)" },
        { ...good, id: "bad-icon", icon: "skull" },
        { ...good, id: "no-title", title: "" },
        { id: 3 },
      ],
    });
    expect(loadPlan().steps.map((s) => s.id)).toEqual([good.id]);
  });

  it("keeps a valid energy check-in and drops an invalid one", () => {
    store.plan = JSON.stringify({ version: 1, steps: [], energy: { level: "low", date: "2026-10-27" } });
    expect(loadPlan().energy).toEqual({ level: "low", date: "2026-10-27" });
    store.plan = JSON.stringify({ version: 1, steps: [], energy: { level: "furious", date: "x" } });
    expect(loadPlan().energy).toBeUndefined();
  });

  it("keeps a valid skipped date and drops a broken one", () => {
    store.plan = JSON.stringify({ version: 1, steps: [], checkInSkipped: "2026-10-27" });
    expect(loadPlan().checkInSkipped).toBe("2026-10-27");
    store.plan = JSON.stringify({ version: 1, steps: [], checkInSkipped: "yesterday" });
    expect(loadPlan().checkInSkipped).toBeUndefined();
  });

  it("addStepToPlan saves a module step at the end, with its stage when the stage is valid", () => {
    addStepToPlan({ title: "Read the job at Acme", minutes: 5, icon: "briefcase", href: "/jobs", stage: "apply" });
    expect(loadPlan().steps.at(-1)).toMatchObject({ title: "Read the job at Acme", href: "/jobs", source: "module", stage: "apply" });
    addStepToPlan({ title: "Call Acme", minutes: 5, stage: "nope" as never });
    expect(loadPlan().steps.at(-1)?.stage).toBeUndefined();
  });

  it("markEvent records known events and ignores unknown ones", () => {
    markEvent("job-saved");
    markEvent("hacked" as never);
    expect(loadPlan().events?.map((e) => e.type)).toEqual(["job-saved"]);
  });

  it("does not throw when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadPlan().steps).toHaveLength(6);
    expect(() => savePlan(starterPlan())).not.toThrow();
  });
});

describe("check-in", () => {
  const morning = new Date(2026, 9, 28, 9);
  const tomorrow = new Date(2026, 9, 29, 9);

  it("uses the local calendar day", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("is due until answered or skipped, and again the next day", () => {
    const plan = starterPlan();
    expect(checkInDue(plan, morning)).toBe(true);
    const answered = setEnergy(plan, "low", morning);
    expect(checkInDue(answered, morning)).toBe(false);
    expect(todayEnergy(answered, morning)).toBe("low");
    expect(checkInDue(answered, tomorrow)).toBe(true);
    expect(todayEnergy(answered, tomorrow)).toBeUndefined();
  });

  it("skipping hides it for today without setting a feeling or touching steps", () => {
    const plan = starterPlan();
    const skipped = setEnergy(plan, null, morning);
    expect(checkInDue(skipped, morning)).toBe(false);
    expect(todayEnergy(skipped, morning)).toBeUndefined();
    expect(skipped.steps).toEqual(plan.steps);
    expect(checkInDue(skipped, tomorrow)).toBe(true);
  });

  it("change forgets today's answer so it is asked again", () => {
    const plan = resetCheckIn(setEnergy(starterPlan(), "stressed", morning));
    expect(checkInDue(plan, morning)).toBe(true);
    expect(plan.energy).toBeUndefined();
  });
});

describe("undoStep", () => {
  it("puts a done step back as the next one, without its done date", () => {
    const id = STARTER_STEPS[1].id;
    const done = completeStep(starterPlan(), id, new Date("2026-10-28T10:00:00Z"));
    const undone = undoStep(done, id);
    expect(undone.steps[1]).toMatchObject({ id, done: false, doneAt: undefined });
    expect(visibleSteps(undone, one)[0].id).toBe(STARTER_STEPS[0].id);
  });
});
