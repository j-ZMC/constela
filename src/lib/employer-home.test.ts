import { describe, expect, it } from "vitest";
import { homeSummary } from "@/lib/employer-home";
import type { EmployerData } from "@/lib/employer-store";
import { computeSeal } from "@/lib/seal";
import { DEMO_VACANCY, type Vacancy } from "@/lib/vacancy";
import type { Permission } from "@/lib/work-profile";

const now = new Date(2026, 10, 1, 12);
const friday = new Date(2026, 10, 6, 12).toISOString();
const lastWeek = new Date(2026, 9, 30, 12).toISOString();
const empty: EmployerData = { vacancies: [], permissions: [], responses: [], guideRead: false, interviews: [], bookings: [] };

const draft: Vacancy = { ...DEMO_VACANCY, id: "v-draft", status: "draft", salary: undefined, schedule: undefined, summary: "A fast-paced team" };
const yes: Permission = { candidateId: "c-1042", vacancyId: DEMO_VACANCY.id, status: "accepted", at: now.toISOString() };

function summary(change: Partial<EmployerData>) {
  const data = { ...empty, ...change };
  return homeSummary(data, computeSeal({ vacancies: data.vacancies, guideRead: data.guideRead, responses: data.responses, ratings: [] }, now), now);
}

describe("homeSummary", () => {
  it("starts with the first job post", () => {
    const home = summary({});
    expect(home.next).toEqual({ title: "Write your first job post.", action: "Start", href: "/employers/vacancies" });
    expect(home.jobs).toEqual(["You have no job posts yet."]);
    expect(home.people).toEqual(["Nobody has said yes yet.", "No answers are due."]);
    expect(home.seal).toEqual(["No seal yet.", "2 things to reach Bronze."]);
  });

  it("opens the draft itself, and says how much is left", () => {
    const home = summary({ vacancies: [draft] });
    expect(home.next).toEqual({ title: "Finish your job post.", detail: "Junior Data Analyst: 3 things left.", action: "Continue", href: "/employers/vacancies?post=v-draft" });
    expect(home.jobs).toEqual(["No job post is live yet.", "1 draft has 3 things left."]);
  });

  it("says when a draft is ready", () => {
    const ready = { ...DEMO_VACANCY, status: "draft" as const };
    expect(summary({ vacancies: [ready] }).next?.detail).toBe("Junior Data Analyst: ready to publish.");
    expect(summary({ vacancies: [ready] }).jobs).toContain("1 draft is ready to publish.");
  });

  it("counts several drafts without guessing which one", () => {
    expect(summary({ vacancies: [DEMO_VACANCY, draft, { ...draft, id: "v-2" }] }).jobs).toEqual(["1 job post is live.", "2 drafts are not published."]);
  });

  it("moves on to finding people once a job post is live", () => {
    expect(summary({ vacancies: [DEMO_VACANCY] }).next).toEqual({ title: "Find people for your job.", detail: "Junior Data Analyst", action: "Open people", href: "/employers/talent" });
  });

  it("puts a person waiting for an answer before everything else", () => {
    const home = summary({ vacancies: [draft], responses: [{ dueAt: friday }] });
    expect(home.next).toEqual({ title: "1 person is waiting for your answer.", detail: "Send it by Friday, November 6.", action: "Open people", href: "/employers/talent" });
    expect(home.people[1]).toBe("1 answer is due Friday, November 6.");
  });

  it("opens the person who is waiting", () => {
    const home = summary({ responses: [{ dueAt: friday, candidateId: "c-1042", vacancyId: "v-1" }] });
    expect(home.next?.href).toBe("/employers/talent?job=v-1&person=c-1042");
  });

  it("names the earliest answer when several are waiting", () => {
    const home = summary({ responses: [{ dueAt: friday }, { dueAt: lastWeek }] });
    expect(home.next?.title).toBe("2 people are waiting for your answer.");
    expect(home.next?.detail).toBe("Send it today.");
    expect(home.people[1]).toBe("2 answers are waiting. The first was due Friday, October 30.");
  });

  it("leaves answers already sent out of what is due", () => {
    expect(summary({ responses: [{ dueAt: friday, answeredAt: lastWeek }] }).people[1]).toBe("No answers are due.");
  });

  it("counts only the latest answer, so a later no doesn't count as a yes", () => {
    const no: Permission = { ...yes, status: "declined", at: new Date(now.getTime() + 1000).toISOString() };
    expect(summary({ permissions: [yes] }).people[0]).toBe("1 person said yes.");
    expect(summary({ permissions: [yes, no] }).people[0]).toBe("Nobody has said yes yet.");
    expect(summary({ permissions: [yes, { ...yes, candidateId: "c-2187" }] }).people[0]).toBe("2 people said yes.");
    // By the time of the answer, not its place in the list.
    expect(summary({ permissions: [no, yes] }).people[0]).toBe("Nobody has said yes yet.");
  });

  it("falls back to the seal once the work is done", () => {
    const home = summary({ vacancies: [DEMO_VACANCY], permissions: [yes] });
    expect(home.next).toEqual({ title: "Read the interviewer guide.", action: "Go there", href: "/employers/guide" });
  });

  it("has no next step when only real candidates can move it", () => {
    const answered = { dueAt: friday, answeredAt: lastWeek };
    const home = summary({ vacancies: [DEMO_VACANCY], permissions: [yes], guideRead: true, responses: [answered] });
    expect(home.seal).toEqual(["You have Silver.", "1 thing to reach Gold."]);
    expect(home.next).toBeNull();
  });

  it("has nothing further to reach at gold", () => {
    const answered = { dueAt: friday, answeredAt: lastWeek };
    const data = { ...empty, vacancies: [DEMO_VACANCY], guideRead: true, responses: [answered] };
    const seal = computeSeal({ vacancies: data.vacancies, guideRead: true, responses: data.responses, ratings: [5, 5, 5, 5, 5] }, now);
    expect(homeSummary(data, seal, now).seal).toEqual(["You have Gold."]);
  });
});
