import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadLocalAccount, loadResumeProfile, saveLocalAccount, saveResumeProfile } from "@/lib/local-profile";

const resume = {
  name: "Jesus",
  email: "jesus@example.com",
  phone: "5550100100",
  skills_found: ["Python"],
  projects: [],
  experience: [],
  sectors: ["IT"],
};

describe("local profile storage", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  it("round-trips the local account", () => {
    saveLocalAccount({ name: "Jesus", email: "jesus@example.com" });
    expect(loadLocalAccount()).toEqual({ name: "Jesus", email: "jesus@example.com" });
  });

  it("round-trips the parsed resume profile", () => {
    saveResumeProfile(resume);
    expect(loadResumeProfile()).toEqual(resume);
  });

  it("rejects broken or outdated stored data", () => {
    store["resume-profile"] = "{broken";
    expect(loadResumeProfile()).toBeNull();
    store["account-profile"] = JSON.stringify({ version: 99, data: { name: "Jesus", email: "" } });
    expect(loadLocalAccount()).toBeNull();
  });
});
