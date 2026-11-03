// Constela for Employers: what the public API can show, for Regina's extension. See SPEC-employers.md.
// Only published job posts and the dates the seal needs leave the browser: never a candidate, a name or a need.
import { z } from "zod";
import { computeSeal, type SealLevel, type SealResponse } from "@/lib/seal";
import { ENVIRONMENT, MAX_SHORT, vacancySchema, type Vacancy } from "@/lib/vacancy";

export const MAX_SNAPSHOT_CHARS = 2_000_000;
export const MAX_COMPANY_CHARS = MAX_SHORT;

const time = z.iso.datetime();

// .strict() on both, so a candidate id sent by mistake is refused and never stored.
export const publicSnapshotSchema = z
  .object({
    vacancies: z.array(vacancySchema.refine((v) => v.status === "published")).max(50),
    guideRead: z.boolean(),
    responses: z.array(z.object({ dueAt: time, answeredAt: time.optional() }).strict()).max(500),
  })
  .strict();

export type PublicSnapshot = z.infer<typeof publicSnapshotSchema>;

export const EMPTY_SNAPSHOT: PublicSnapshot = { vacancies: [], guideRead: false, responses: [] };

type EmployerSide = { vacancies: Vacancy[]; guideRead: boolean; responses: SealResponse[] };

export function publicSnapshot({ vacancies, guideRead, responses }: EmployerSide): PublicSnapshot {
  return {
    vacancies: vacancies.filter((v) => v.status === "published"),
    guideRead,
    responses: responses.map(({ dueAt, answeredAt }) => ({ dueAt, answeredAt })),
  };
}

// The stored copy holds the data and never the level, so the seal drops as soon as a metric or a date does.
// shortcut: no candidate ratings exist yet, so gold can't be reached; add them once real candidates can rate a process.
const sealLevel = (snapshot: PublicSnapshot, now: Date): SealLevel | null => computeSeal({ ...snapshot, ratings: [] }, now).level;

export type PublicSeal = { company: string; level: SealLevel | null; vacancyIds: string[] };

// shortcut: one snapshot holds one employer, so every job post in it shares a seal; give each company its own with accounts.
export function publicSeal(snapshot: PublicSnapshot, company: string, now: Date): PublicSeal {
  const asked = company.trim().toLowerCase();
  const posts = snapshot.vacancies.filter((v) => v.company.toLowerCase() === asked);
  if (posts.length === 0) return { company, level: null, vacancyIds: [] };
  return { company: posts[0].company, level: sealLevel(snapshot, now), vacancyIds: posts.map((v) => v.id) };
}

// An allowlist, like the anonymous profile: a field added to Vacancy later stays private until someone adds it here.
function publicCard(v: Vacancy) {
  return {
    id: v.id,
    company: v.company,
    title: v.title,
    summary: v.summary,
    tasks: v.tasks,
    essential: v.essential.map((r) => r.text),
    niceToHave: v.niceToHave.map((r) => r.text),
    salary: v.salary,
    schedule: v.schedule,
    modality: v.modality,
    location: v.location,
    environment: v.environment?.map((factor) => ENVIRONMENT[factor]),
    accommodations: v.accommodations,
    process: v.process.map(({ name, format, minutes, who, alternative }) => ({ name, format, minutes, who, alternative })),
    responseDays: v.responseDays,
  };
}

export function publicVacancy(snapshot: PublicSnapshot, id: string, now: Date) {
  const vacancy = snapshot.vacancies.find((v) => v.id === id);
  return vacancy ? { ...publicCard(vacancy), seal: sealLevel(snapshot, now) } : null;
}
