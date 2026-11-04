import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_LEARN_FILTERS, countLearn, loadLearnFilters, matchesLearn, recommend, saveLearnFilters } from "@/lib/learn";
import { AREAS, COSTS, FORMATS, KINDS, MEXICO_RESOURCES_LEGACY, RESOURCES } from "@/lib/learn-resources";
import type { SavedJob } from "@/lib/saved-jobs";

const saved = (title: string, description: string, required: string[] = []) =>
  ({ job: { title, description, company: "Acme", url: `https://a.example/${title}` }, savedAt: "x", posting: { required, nice: [], from: "page", at: "x" } }) as unknown as SavedJob;

describe("the resource lists", () => {
  it("are well formed: unique ids, https links, known areas and kinds, a line about each", () => {
    for (const list of [RESOURCES, MEXICO_RESOURCES_LEGACY]) {
      expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
      for (const r of list) {
        expect(r.url, r.id).toMatch(/^https:\/\//);
        expect(r.areas.length, r.id).toBeGreaterThan(0);
        expect(r.areas.every((a) => a in AREAS), r.id).toBe(true);
        expect([r.kind in KINDS, r.cost in COSTS, r.format in FORMATS], r.id).toEqual([true, true, true]);
        expect(r.about.length, r.id).toBeGreaterThan(20);
        expect(r.skills.every((s) => s === s.toLowerCase()), r.id).toBe(true);
      }
    }
  });

  it("keeps the Mexico list as legacy, and shows only the United States", () => {
    expect(MEXICO_RESOURCES_LEGACY.length).toBeGreaterThanOrEqual(33);
    expect(RESOURCES.some((r) => r.id === "conocer")).toBe(false);
    expect(RESOURCES.some((r) => r.id === "anthropic-academy")).toBe(true);
  });
});

describe("recommend", () => {
  it("counts what saved jobs ask for that the CV does not show, and picks resources for it", () => {
    const { gaps, picks } = recommend(
      [saved("Data analyst", "You will write SQL every day.", ["2+ years of Excel"]), saved("Analyst", "SQL and Tableau.")],
      ["Excel", "Word"],
    );
    expect(gaps.find((g) => g.skill === "sql")?.jobs).toBe(2);
    expect(gaps.some((g) => g.skill === "excel")).toBe(false);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((p) => p.skills.length > 0)).toBe(true);
    expect(picks[0].skills.some((s) => s.skill === "sql")).toBe(true);
  });

  it("matches whole words only", () => {
    expect(recommend([saved("Writer", "She said the airline was fine.")], []).gaps.some((g) => g.skill === "ai")).toBe(false);
    expect(recommend([saved("Engineer", "Build AI agents.")], []).gaps.some((g) => g.skill === "ai")).toBe(true);
  });

  it("has nothing to say without saved jobs", () => {
    expect(recommend([], ["SQL"])).toEqual({ gaps: [], picks: [] });
  });
});

describe("learn filters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("filters by area, kind, students and words, and counts each choice", () => {
    const students = RESOURCES.filter((r) => matchesLearn(r, { ...NO_LEARN_FILTERS, students: true }));
    expect(students.length).toBeGreaterThan(3);
    expect(students.every((r) => r.students)).toBe(true);
    expect(RESOURCES.filter((r) => matchesLearn(r, { ...NO_LEARN_FILTERS, text: "anthropic" })).map((r) => r.id)).toContain("anthropic-academy");
    expect(countLearn(NO_LEARN_FILTERS, "kind", "repository")).toBe(RESOURCES.filter((r) => r.kind === "repository").length);
    expect(countLearn({ ...NO_LEARN_FILTERS, kind: "community" }, "area", "all")).toBe(RESOURCES.filter((r) => r.kind === "community").length);
  });

  it("keeps the filters, and falls back to all for values edited by hand", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } });
    saveLearnFilters({ ...NO_LEARN_FILTERS, area: "data", students: true });
    expect(loadLearnFilters()).toEqual({ ...NO_LEARN_FILTERS, area: "data", students: true });
    store["learn-filters"] = JSON.stringify({ area: "moon", kind: "bootcamp", text: 5 });
    expect(loadLearnFilters()).toEqual({ ...NO_LEARN_FILTERS, kind: "bootcamp" });
  });
});
