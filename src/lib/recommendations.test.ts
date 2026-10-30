import { describe, expect, it } from "vitest";
import { buildRecommendedJobsRequest } from "@/lib/recommendations";

const profile = {
  name: "Alex Rivera",
  email: "jesus@example.com",
  phone: "5550100100",
  skills_found: ["Python", "SQL"],
  projects: ["Financial data pipeline"],
  experience: ["Built data pipelines"],
  sectors: ["IT", "Data and Analytics"],
};

describe("recommended jobs", () => {
  it("builds a CV and questionnaire query without personal fields", () => {
    const request = buildRecommendedJobsRequest(profile, { workplace: ["remote"] }, ["adhd:distraction_and_interruptions"]);
    expect(request.userBlockers).toEqual(["adhd:distraction_and_interruptions"]);
    expect(request.query).toContain("Python");
    expect(request.query).toContain("remote");
    expect(request.query).not.toContain(profile.name);
    expect(request.query).not.toContain(profile.email);
    expect(request.query).not.toContain(profile.phone);
  });

  it("caps the recommendation query", () => {
    const longProfile = { ...profile, experience: ["x".repeat(6000)] };
    expect(buildRecommendedJobsRequest(longProfile, {}, []).query.length).toBeLessThanOrEqual(200);
  });
});
