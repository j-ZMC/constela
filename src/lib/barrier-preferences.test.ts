import { beforeEach, describe, expect, it, vi } from "vitest";
import { barrierCatalog, loadBarrierPreferences, saveBarrierPreferences } from "@/lib/barrier-preferences";

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
