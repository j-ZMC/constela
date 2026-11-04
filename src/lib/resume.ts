import { z } from "zod";

const resumeProfileSchema = z.object({
  name: z.string().max(200),
  email: z.string().max(320),
  phone: z.string().max(80),
  skills_found: z.array(z.string().max(120)).max(200),
  projects: z.array(z.string().max(1000)).max(100),
  experience: z.array(z.string().max(1000)).max(200),
  sectors: z.array(z.string().max(120)).max(50),
}).strict();

export type ResumeProfile = z.infer<typeof resumeProfileSchema>;

export function parseResumeProfile(value: unknown): ResumeProfile | null {
  const parsed = resumeProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function buildResumeRecommendationText(profile: ResumeProfile): string {
  return [
    ...profile.skills_found,
    ...profile.sectors,
    ...profile.experience,
    ...profile.projects,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 4000);
}
