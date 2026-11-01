import type { Answers } from "@/lib/profile";
import type { JobSearchRequest } from "@/lib/jobs";
import { buildResumeRecommendationText, type ResumeProfile } from "@/lib/resume";

export function buildRecommendedJobsRequest(
  profile: ResumeProfile,
  answers: Partial<Answers>,
  userBlockers: string[],
): JobSearchRequest {
  const workplace = Array.isArray(answers.workplace) ? answers.workplace.filter((value) => value !== "not-sure") : [];
  const preference = workplace.length ? `Preferred work arrangement: ${workplace.join(", ")}.` : "";
  const query = `${buildResumeRecommendationText(profile)} ${preference}`.trim().slice(0, 200);
  return { query: query || "jobs matching this profile", userBlockers };
}
