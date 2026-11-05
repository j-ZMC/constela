import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearResumeProfile, loadLocalAccount, loadResumeProfile, saveLocalAccount, saveResumeProfile } from "@/lib/local-profile";

const resume = {
  name: "Alex",
  email: "alex@example.com",
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
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  });

  it("tells open pages when the CV is saved or removed, so Jobs can start again", () => {
    saveResumeProfile(resume);
    clearResumeProfile();
    expect(vi.mocked(window.dispatchEvent).mock.calls.map(([e]) => e.type)).toEqual(["resume-profile-change", "resume-profile-change"]);
  });

  it("round-trips the local account", () => {
    saveLocalAccount({ name: "Alex", email: "alex@example.com" });
    expect(loadLocalAccount()).toEqual({ name: "Alex", email: "alex@example.com" });
  });

  it("round-trips the parsed resume profile", () => {
    saveResumeProfile(resume);
    expect(loadResumeProfile()).toEqual(resume);
  });

  it("rejects broken or outdated stored data", () => {
    store["resume-profile"] = "{broken";
    expect(loadResumeProfile()).toBeNull();
    store["account-profile"] = JSON.stringify({ version: 99, data: { name: "Alex", email: "" } });
    expect(loadLocalAccount()).toBeNull();
  });
});
