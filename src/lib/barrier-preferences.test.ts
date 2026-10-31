import { beforeEach, describe, expect, it, vi } from "vitest";
import { NEEDS_GROUPS, barrierCatalog, fullBarrierIds, loadBarrierPreferences, saveBarrierPreferences } from "@/lib/barrier-preferences";

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

  it("distinguishes an unsaved profile from a saved empty selection", () => {
    expect(loadBarrierPreferences()).toBeNull();
    saveBarrierPreferences([]);
    expect(loadBarrierPreferences()).toEqual([]);
  });
});

describe("needs groups", () => {
  it("place every catalog option in exactly one group", () => {
    const all = barrierCatalog.categories.flatMap((c) => c.subtypes.map((s) => `${c.id}:${s.id}`));
    const grouped = NEEDS_GROUPS.flatMap((g) => g.ids);
    expect([...grouped].sort()).toEqual([...all].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("never use a diagnosis as a group name", () => {
    const names = barrierCatalog.categories.map((c) => c.name_en.toLowerCase());
    for (const g of NEEDS_GROUPS) expect(names.some((n) => g.label.toLowerCase().includes(n))).toBe(false);
  });

  it("turn profile subtype ids into stored ids", () => {
    expect(fullBarrierIds(["sound", "sensory_load"])).toEqual(["autism_spectrum:sensory_load", "sensory_processing_differences:sound"]);
  });
});
