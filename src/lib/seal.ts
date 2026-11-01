// Constela for Employers: the Neuroinclusive seal (Sello Neuroincluyente). See SPEC-employers.md.
// The level is computed from platform data every time and never stored, so it drops as soon as a metric does.
// shortcut: v1 thresholds are proposals until the team confirms them; the ratings check waits for candidate reviews.
import { CLEAR_SCORE, clarityScore, offersAlternativeFormat, type Vacancy } from "@/lib/vacancy";

export const SEAL_LEVELS = ["bronze", "silver", "gold"] as const;
export type SealLevel = (typeof SEAL_LEVELS)[number];

// An answer the employer owes a candidate after a hiring step, due on the date they promised.
export type SealResponse = { dueAt: string; answeredAt?: string; candidateId?: string; vacancyId?: string };
export type SealInput = { vacancies: Vacancy[]; guideRead: boolean; responses: SealResponse[]; ratings: number[] };
// todo says what to do next, never what went wrong; href is where to do it.
export type SealCheck = { id: string; level: SealLevel; met: boolean; detail: string; todo: string; href?: string };
export type Seal = { level: SealLevel | null; checks: SealCheck[] };

const SHARE = 0.9; // the target from the features document: 90% of vacancies
const MIN_RATINGS = 5;
const MIN_AVERAGE = 4;

export function computeSeal(input: SealInput, now: Date): Seal {
  const published = input.vacancies.filter((v) => v.status === "published");
  const share = (n: number) => published.length > 0 && n / published.length >= SHARE;
  const clear = published.filter((v) => clarityScore(v).score >= CLEAR_SCORE).length;
  const adjusted = published.filter((v) => v.accommodations.length > 0 && offersAlternativeFormat(v)).length;
  // An answer counts once it is sent or overdue; one still in time is not judged yet.
  const due = input.responses.filter((r) => r.answeredAt !== undefined || Date.parse(r.dueAt) < now.getTime());
  const onTime = due.filter((r) => r.answeredAt !== undefined && Date.parse(r.answeredAt) <= Date.parse(r.dueAt)).length;
  const average = input.ratings.reduce((sum, r) => sum + r, 0) / (input.ratings.length || 1);

  const checks: SealCheck[] = [
    {
      id: "clarity",
      level: "bronze",
      met: share(clear),
      detail: `${clear} of ${published.length} published vacancies have a clarity score of ${CLEAR_SCORE} or more.`,
      todo: `Publish vacancies with a clarity score of ${CLEAR_SCORE} or more.`,
      href: "/employers/vacancies",
    },
    {
      id: "training",
      level: "bronze",
      met: input.guideRead,
      detail: input.guideRead ? "You read the interviewer guide." : "The guide takes a few minutes.",
      todo: "Read the interviewer guide.",
      href: "/employers/guide",
    },
    {
      id: "adjustments",
      level: "silver",
      met: share(adjusted),
      detail: `${adjusted} of ${published.length} published vacancies offer adjustments and another interview format.`,
      todo: "Offer default adjustments and another interview format in your vacancies.",
      href: "/employers/vacancies",
    },
    {
      id: "response-time",
      level: "silver",
      met: due.length > 0 && onTime === due.length,
      detail: `${onTime} of ${due.length} answers to candidates were sent by the promised date.`,
      todo: "Send each candidate your answer by the date you promised.",
      href: "/employers/talent",
    },
    {
      id: "ratings",
      level: "gold",
      met: input.ratings.length >= MIN_RATINGS && average >= MIN_AVERAGE,
      detail: input.ratings.length
        ? `Candidates rate your process ${average.toFixed(1)} out of 5 (${input.ratings.length} ratings). Gold needs ${MIN_AVERAGE} or more from ${MIN_RATINGS} people.`
        : "Ratings come with real candidates.",
      todo: `Earn an average of ${MIN_AVERAGE} or more out of 5 from ${MIN_RATINGS} candidates.`,
    },
  ];

  // A level counts only when it and every level below it are fully met.
  let level: SealLevel | null = null;
  for (const l of SEAL_LEVELS) {
    if (!checks.filter((c) => c.level === l).every((c) => c.met)) break;
    level = l;
  }
  return { level, checks };
}

export function nextLevel({ level }: Seal): SealLevel | null {
  return SEAL_LEVELS[level ? SEAL_LEVELS.indexOf(level) + 1 : 0] ?? null;
}
