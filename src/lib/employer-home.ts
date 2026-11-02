// Constela for Employers: what Home shows. Worked out from the stored data on every look, like the seal.
import type { EmployerData } from "@/lib/employer-store";
import { SEAL_NAMES, nextLevel, type Seal } from "@/lib/seal";
import { leftText, thingsLeft } from "@/lib/vacancy-editor";
import { latestPermission } from "@/lib/work-profile";

const JOBS = "/employers/vacancies";
const PEOPLE = "/employers/talent";

export type NextStep = { title: string; detail?: string; action: string; href: string };
export type HomeSummary = { next: NextStep | null; jobs: string[]; people: string[]; seal: string[] };

const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
const dayText = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

// One thing at a time, in this order: a person is waiting, then the work that comes first in the process, then the seal.
function nextStep(data: EmployerData, seal: Seal, now: Date): NextStep | null {
  const { vacancies, permissions } = data;
  const owed = data.responses.filter((r) => !r.answeredAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  if (owed[0]) {
    const late = Date.parse(owed[0].dueAt) < now.getTime();
    return {
      title: `${count(owed.length, "person is", "people are")} waiting for your answer.`,
      detail: late ? "Send it today." : `Send it by ${dayText(owed[0].dueAt)}.`,
      action: "Open people",
      href: PEOPLE,
    };
  }
  if (vacancies.length === 0) return { title: "Write your first job post.", action: "Start", href: JOBS };

  const draft = vacancies.find((v) => v.status === "draft");
  if (draft) {
    const left = thingsLeft(draft);
    return { title: "Finish your job post.", detail: `${draft.title}: ${left ? leftText(left) : "ready to publish."}`, action: "Continue", href: `${JOBS}?post=${encodeURIComponent(draft.id)}` };
  }
  const waiting = vacancies.find((v) => !permissions.some((p) => p.vacancyId === v.id));
  if (waiting) return { title: "Find people for your job.", detail: waiting.title, action: "Open people", href: PEOPLE };

  const level = nextLevel(seal);
  const check = seal.checks.find((c) => c.level === level && !c.met && c.href);
  return check?.href ? { title: check.todo, action: "Go there", href: check.href } : null;
}

function jobLines({ vacancies }: EmployerData): string[] {
  if (vacancies.length === 0) return ["You have no job posts yet."];
  const live = vacancies.filter((v) => v.status === "published").length;
  const drafts = vacancies.filter((v) => v.status === "draft");
  const liveText = live === 0 ? "No job post is live yet." : `${count(live, "job post is", "job posts are")} live.`;
  if (drafts.length === 0) return [liveText];
  if (drafts.length > 1) return [liveText, `${drafts.length} drafts are not published.`];
  const left = thingsLeft(drafts[0]);
  return [liveText, left ? `1 draft has ${count(left, "thing", "things")} left.` : "1 draft is ready to publish."];
}

function peopleLines({ permissions, responses }: EmployerData, now: Date): string[] {
  const pairs = new Map(permissions.map((p) => [`${p.candidateId}:${p.vacancyId}`, p]));
  const yes = [...pairs.values()].filter((p) => latestPermission(permissions, p.candidateId, p.vacancyId)?.status === "accepted").length;
  const owed = responses.filter((r) => !r.answeredAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const yesText = yes === 0 ? "Nobody has said yes yet." : `${count(yes, "person", "people")} said yes.`;
  if (owed.length === 0) return [yesText, "No answers are due."];
  const verb = Date.parse(owed[0].dueAt) < now.getTime() ? "was due" : "is due";
  return [yesText, owed.length === 1 ? `1 answer ${verb} ${dayText(owed[0].dueAt)}.` : `${owed.length} answers are waiting. The first ${verb} ${dayText(owed[0].dueAt)}.`];
}

function sealLines(seal: Seal): string[] {
  const next = nextLevel(seal);
  const now = seal.level ? `You have ${SEAL_NAMES[seal.level]}.` : "No seal yet.";
  if (!next) return [now];
  const toDo = seal.checks.filter((c) => c.level === next && !c.met).length;
  return [now, `${count(toDo, "thing", "things")} to reach ${SEAL_NAMES[next]}.`];
}

export const homeSummary = (data: EmployerData, seal: Seal, now: Date): HomeSummary => ({
  next: nextStep(data, seal, now),
  jobs: jobLines(data),
  people: peopleLines(data, now),
  seal: sealLines(seal),
});
