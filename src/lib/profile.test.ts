import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ADAPTATIONS,
  QUESTIONS,
  toJobPreferences,
  loadProfile,
  saveProfile,
  toAdaptations,
} from "@/lib/profile";

describe("toAdaptations", () => {
  it("returns the defaults for an empty profile", () => {
    expect(toAdaptations({})).toEqual(DEFAULT_ADAPTATIONS);
    expect(DEFAULT_ADAPTATIONS.stepsAtOnce).toBe(3);
  });

  it.each([
    [{ reading: "summary" }, true],
    [{ longText: "tiring" }, true],
    [{ longText: "hard" }, true],
    [{ reading: "full", longText: "fine" }, false],
  ] as const)("summaryMode for %o is %s", (answers, expected) => {
    expect(toAdaptations(answers).summaryMode).toBe(expected);
  });

  it("offers a Listen button when the person prefers listening", () => {
    expect(toAdaptations({ reading: "listen" }).listenButton).toBe(true);
    expect(toAdaptations({ reading: "steps" }).listenButton).toBe(false);
  });

  it("suggests reading aids only when long texts are really hard", () => {
    expect(toAdaptations({ longText: "hard" }).suggestReadingAids).toBe(true);
    expect(toAdaptations({ longText: "tiring" }).suggestReadingAids).toBe(false);
  });

  it.each([
    ["ask", false],
    ["guess", true],
    ["stuck", true],
  ] as const)("explicitSteps when unclear instructions mean %s", (unclear, expected) => {
    expect(toAdaptations({ unclear }).explicitSteps).toBe(expected);
  });

  it.each([
    ["fine", false],
    ["heads-up", true],
    ["stressful", true],
  ] as const)("headsUpOnChanges when changes feel %s", (changes, expected) => {
    expect(toAdaptations({ changes }).headsUpOnChanges).toBe(expected);
  });

  it("shows one step at a time when there are too many options", () => {
    expect(toAdaptations({ startBlockers: ["too-many-options"] }).stepsAtOnce).toBe(1);
    expect(toAdaptations({ startBlockers: ["big-tasks"] }).stepsAtOnce).toBe(3);
  });

  it("maps each start blocker to its My plan helper", () => {
    const a = toAdaptations({ startBlockers: ["big-tasks", "time", "distracted"] });
    expect(a.offerBreakdownFirst).toBe(true);
    expect(a.showDurations).toBe(true);
    expect(a.importantFirst).toBe(true);
  });

  it("turns workplace answers into job filters, ignoring 'not sure yet'", () => {
    expect(toAdaptations({ workplace: ["remote", "hybrid"] }).workplaceFilters).toEqual(["remote", "hybrid"]);
    expect(toAdaptations({ workplace: ["not-sure"] }).workplaceFilters).toEqual([]);
  });

  it.each([
    ["independent", false],
    ["check-ins", true],
    ["regular", true],
  ] as const)("gentlePacing when support is %s", (support, expected) => {
    expect(toAdaptations({ support }).gentlePacing).toBe(expected);
  });
});

describe("QUESTIONS", () => {
  it("has 7 answer kinds, each with options; workplace conditions live in Job conditions", () => {
    expect(QUESTIONS).toHaveLength(7);
    expect(QUESTIONS.map((q) => q.id)).not.toContain("sensory");
    for (const q of QUESTIONS) expect(q.options.length).toBeGreaterThan(1);
  });
});

describe("loadProfile / saveProfile", () => {
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

  it("round-trips a profile", () => {
    saveProfile({ reading: "summary", startBlockers: ["time"] });
    expect(loadProfile()).toEqual({ reading: "summary", startBlockers: ["time"] });
  });

  it("returns null when nothing is saved", () => {
    expect(loadProfile()).toBeNull();
  });

  it.each([
    ["broken JSON", "{not json"],
    ["an unknown version", JSON.stringify({ version: 99, answers: { reading: "summary" } })],
    ["answers that are not an object", JSON.stringify({ version: 1, answers: "nope" })],
  ])("returns null for %s", (_, raw) => {
    store.profile = raw;
    expect(loadProfile()).toBeNull();
  });

  it("drops values that are not valid options", () => {
    store.profile = JSON.stringify({
      version: 1,
      answers: { reading: "shout", startBlockers: ["time", "lasers"], workplace: "remote", sensory: ["noise"] },
    });
    // "sensory" was a question once; old saved answers to it are dropped like any unknown value.
    expect(loadProfile()).toEqual({ startBlockers: ["time"] });
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
    expect(loadProfile()).toBeNull();
    expect(() => saveProfile({ reading: "full" })).not.toThrow();
  });
});

describe("toJobPreferences", () => {
  it("turns answers into barrier subtypes and workplace choices, never categories", () => {
    const prefs = toJobPreferences({ longText: "hard", workplace: ["remote", "not-sure"] });
    expect(prefs.barriers).toEqual(["high_reading_load", "time_pressure_for_text"]);
    expect(prefs.workplace).toEqual(["remote"]);
    expect(toJobPreferences({})).toEqual({ barriers: [], workplace: [] });
  });

  it("only uses subtype ids that exist in the job filter's barrier list", async () => {
    const { readFileSync } = await import("node:fs");
    const config = JSON.parse(readFileSync("backend/config/neurodivergence_job_barriers.json", "utf-8"));
    const known = new Set(config.categories.flatMap((c: { subtypes: { id: string }[] }) => c.subtypes.map((s) => s.id)));
    const all = toJobPreferences({
      longText: "hard",
      unclear: "stuck",
      changes: "stressful",
      startBlockers: ["distracted", "time"],
    }).barriers;
    expect(all.filter((id) => !known.has(id))).toEqual([]);
  });
});
