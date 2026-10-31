import { describe, expect, it } from "vitest";
import { buildResumeRecommendationText, parseResumeProfile, type ResumeProfile } from "@/lib/resume";

const profile: ResumeProfile = {
  name: "Alex Rivera",
  email: "jesus@example.com",
  phone: "5550100100",
  skills_found: ["Python", "SQL"],
  projects: ["Financial data pipeline"],
  experience: ["Built data pipelines"],
  sectors: ["IT", "Data and Analytics"],
};

describe("resume profile", () => {
  it("accepts the parser JSON shape", () => {
    expect(parseResumeProfile(profile)).toEqual(profile);
  });

  it("rejects malformed profile fields", () => {
    expect(parseResumeProfile({ ...profile, skills_found: "Python" })).toBeNull();
    expect(parseResumeProfile({ ...profile, email: 42 })).toBeNull();
  });

  it("builds recommendation text without personal fields", () => {
    const text = buildResumeRecommendationText(profile);
    expect(text).toContain("Python");
    expect(text).toContain("Financial data pipeline");
    expect(text).not.toContain(profile.name);
    expect(text).not.toContain(profile.email);
    expect(text).not.toContain(profile.phone);
  });
});
