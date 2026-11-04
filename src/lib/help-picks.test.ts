import { afterEach, describe, expect, it, vi } from "vitest";
import { HELP, NEURO_TYPES, NEURO_TYPE_IDS, applyHelp, describeVisual, loadHelpPicks, mergePrefs, saveHelpPicks } from "@/lib/help-picks";
import { DEFAULT_PREFS, cleanPrefs } from "@/lib/personalization";
import { toAdaptations } from "@/lib/profile";

describe("what is hard: help picks", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("turns each pick into help that the rest of the app already reads", () => {
    const { answers, prefs } = applyHelp(HELP.map((h) => h.id), {}, DEFAULT_PREFS);
    expect(toAdaptations(answers)).toMatchObject({
      summaryMode: true,
      listenButton: true,
      explicitSteps: true,
      stepsAtOnce: 1,
      offerBreakdownFirst: true,
      headsUpOnChanges: true,
    });
    expect(prefs).toMatchObject({ calm: true, soft: 2, slowVoice: true, font: "dyslexic", ctlSize: 52, detail: "reduced" });
  });

  it("keeps what the person already chose, and changes nothing without picks", () => {
    const before = { startBlockers: ["none" as const], workplace: ["remote" as const] };
    const { answers } = applyHelp(["starting"], before, DEFAULT_PREFS);
    expect(answers).toEqual({ startBlockers: ["too-many-options", "big-tasks"], workplace: ["remote"] });
    const kept = applyHelp(["starting"], { startBlockers: ["time"] }, DEFAULT_PREFS).answers.startBlockers;
    expect(kept).toEqual(["time", "too-many-options", "big-tasks"]);
    expect(applyHelp([], before, DEFAULT_PREFS)).toEqual({ answers: before, prefs: DEFAULT_PREFS });
  });

  it("gives every type settings within Personalize's limits, described in plain words", () => {
    for (const id of NEURO_TYPE_IDS) {
      const prefs = mergePrefs(DEFAULT_PREFS, NEURO_TYPES[id].prefs);
      expect(cleanPrefs(prefs), id).toEqual(prefs);
      expect(describeVisual(NEURO_TYPES[id].prefs), id).not.toBe("");
    }
    expect(describeVisual(NEURO_TYPES.dyslexia.prefs)).toBe("An easier-to-read font, bigger text, more space, shorter lines");
  });

  it("joins settings so the stronger one wins, and adding help never takes any away", () => {
    const both = applyHelp([], {}, { ...DEFAULT_PREFS, size: 130, cursor: "xlarge" }, ["dyslexia", "dyspraxia"]).prefs;
    expect(both).toMatchObject({ size: 130, cursor: "xlarge", font: "dyslexic", ctlSize: 52, lh: 1.8 });
    expect(mergePrefs({ ...DEFAULT_PREFS, font: "verdana" }, { font: "system" }).font).toBe("verdana");
  });

  it("remembers the picks, and tells 'not asked yet' from 'decide later'", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    expect(loadHelpPicks()).toBeNull();
    saveHelpPicks([]);
    expect(loadHelpPicks()).toEqual([]);
    store.set("help-picks", JSON.stringify(["screen", "made-up"]));
    expect(loadHelpPicks()).toEqual(["screen"]);
  });
});
