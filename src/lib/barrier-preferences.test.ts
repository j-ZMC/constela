import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  barrierCatalog,
  barrierGroups,
  loadBarrierPreferences,
  loadCustomBlockers,
  normalizeCustomBlocker,
  saveBarrierPreferences,
} from "@/lib/barrier-preferences";

describe("barrier preferences", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    });
  });

  it("uses condition IDs from the backend catalog", () => {
    expect(barrierCatalog.categories[0].subtypes[0].id).toBe("distraction_and_interruptions");
    expect(barrierCatalog.categories).toHaveLength(11);
  });

  it("shows every catalog option in exactly one group, and no group is named after a condition", () => {
    const shown = barrierGroups.flatMap((group) => group.options.map((option) => option.id));
    const all = barrierCatalog.categories.flatMap((c) => c.subtypes.map((s) => `${c.id}:${s.id}`));
    expect(shown.toSorted()).toEqual(all.toSorted());
    expect(barrierGroups.every((group) => group.options.every((option) => option.subtype))).toBe(true);
    const names = barrierCatalog.categories.map((c) => c.name_en.toLowerCase());
    expect(barrierGroups.filter((group) => names.some((n) => group.name.toLowerCase().includes(n)))).toEqual([]);
  });

  it("saves and loads selected category:condition IDs", () => {
    saveBarrierPreferences(["adhd:distraction_and_interruptions"]);
    expect(loadBarrierPreferences()).toEqual(["adhd:distraction_and_interruptions"]);
  });

  it("drops unknown IDs and duplicates from stored preferences", () => {
    store["job-barrier-preferences"] = JSON.stringify({
      user_blockers: ["adhd:distraction_and_interruptions", "unknown:bad", "adhd:distraction_and_interruptions"],
    });
    expect(loadBarrierPreferences()).toEqual(["adhd:distraction_and_interruptions"]);
  });

  it("saves the person's own words, normalized, and keeps them when only the catalog choices are saved", () => {
    saveBarrierPreferences([], ["  Night   Shift ", "night shift", 'bad"word', "open office"]);
    expect(loadCustomBlockers()).toEqual(["night shift", "open office"]);
    saveBarrierPreferences(["adhd:distraction_and_interruptions"]);
    expect(loadCustomBlockers()).toEqual(["night shift", "open office"]);
  });

  it("normalizes tags and rejects text that cannot be one", () => {
    expect(normalizeCustomBlocker("  Open   Office ")).toBe("open office");
    expect(normalizeCustomBlocker("C++")).toBe("c++");
    expect(normalizeCustomBlocker("")).toBeNull();
    expect(normalizeCustomBlocker("x".repeat(41))).toBeNull();
    expect(normalizeCustomBlocker("--option")).toBe("--option");
    expect(normalizeCustomBlocker("a\nb")).toBe("a b");
  });

  it("distinguishes an unsaved profile from a saved empty selection", () => {
    expect(loadBarrierPreferences()).toBeNull();
    saveBarrierPreferences([]);
    expect(loadBarrierPreferences()).toEqual([]);
  });
});
