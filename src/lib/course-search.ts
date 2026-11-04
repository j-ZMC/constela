// "Company courses": courses from the official course sites of companies like Anthropic or AWS, from the hand-checked
// list in learn-resources.ts. All on this computer: nothing is sent anywhere, and it works without internet.
import { z } from "zod";
import { RESOURCES, type Resource } from "@/lib/learn-resources";

const MAX_RESULTS = 8;

// The official course sites, per company: a course belongs to a company when its link is on one of them.
export const ACADEMIES = {
  Anthropic: ["anthropic.skilljar.com", "academy.claude.com"],
  AWS: ["skillbuilder.aws", "aws.amazon.com"],
  Google: ["skills.google", "grow.google"],
  Microsoft: ["learn.microsoft.com"],
  NVIDIA: ["nvidia.com"],
  OpenAI: ["academy.openai.com"],
  "Hugging Face": ["huggingface.co"],
  IBM: ["skillsbuild.org"],
  Cisco: ["netacad.com"],
  Salesforce: ["trailhead.salesforce.com"],
  HubSpot: ["academy.hubspot.com"],
  Databricks: ["databricks.com"],
  MongoDB: ["learn.mongodb.com"],
} as const;
export type Academy = keyof typeof ACADEMIES;
const NAMES = Object.keys(ACADEMIES) as [Academy, ...Academy[]];

export const courseSearchRequest = z
  .object({
    topic: z.string().trim().min(2).max(80),
    // Empty: every company.
    companies: z.array(z.enum(NAMES)).max(NAMES.length).default([]),
  })
  .strict();
export type CourseSearchRequest = z.infer<typeof courseSearchRequest>;

const webUrl = z.string().url().refine((url) => /^https:\/\//i.test(url));
export const courseResults = z.object({
  courses: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        company: z.enum(NAMES),
        url: webUrl,
        cost: z.enum(["free", "paid", "unknown"]),
        about: z.string().max(240),
      }),
    )
    .max(MAX_RESULTS),
});
export type CourseResults = z.infer<typeof courseResults>;

export class CourseSearchError extends Error {
  constructor(public readonly code: "not_configured" | "timeout" | "failed") {
    super(code);
  }
}

// The company whose official site a link is on, or null when it is on none of them.
export function academyOf(url: string, companies: readonly Academy[]): Academy | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return (companies.length ? companies : NAMES).find((c) => ACADEMIES[c].some((d) => host === d || host.endsWith(`.${d}`))) ?? null;
}

// The cost words the course cards use.
const costOf = (c: Resource["cost"]): "free" | "paid" | "unknown" => (c === "free" ? "free" : c === "paid" ? "paid" : "unknown");

// With a company chosen, all of its courses, the ones closest to the topic first. With none, only courses that match
// a word of the topic, so the list does not fill with every company's courses.
export function searchCourses(r: CourseSearchRequest, list: readonly Resource[] = RESOURCES): CourseResults {
  const words = r.topic.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const ranked = list.flatMap((res) => {
    const company = academyOf(res.url, r.companies);
    if (!company) return [];
    const text = [res.title, res.provider, res.about, ...res.skills, ...res.areas].join(" ").toLowerCase();
    const score = words.filter((w) => text.includes(w)).length;
    if (!r.companies.length && score === 0) return [];
    return [{ score, course: { title: res.title.slice(0, 160), company, url: res.url, cost: costOf(res.cost), about: res.about.slice(0, 240) } }];
  });
  return { courses: ranked.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS).map((x) => x.course) };
}
