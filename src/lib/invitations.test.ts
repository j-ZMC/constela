import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmployerData } from "@/lib/employer-store";
import { addInterviewStep, listInvitations, waitingInvitations } from "@/lib/invitations";
import { loadPlan } from "@/lib/plan";
import { DEMO_VACANCY } from "@/lib/vacancy";
import { DEMO_PROFILES, type Permission } from "@/lib/work-profile";

const [person] = DEMO_PROFILES;
const permit = (status: Permission["status"], minute: number): Permission => ({ candidateId: person.id, vacancyId: DEMO_VACANCY.id, status, at: `2026-10-30T10:0${minute}:00.000Z` });
const data = (change: Partial<EmployerData> = {}): EmployerData => ({ vacancies: [DEMO_VACANCY], permissions: [], responses: [], guideRead: false, interviews: [], bookings: [], ...change });

describe("listInvitations", () => {
  it("gives one invitation per person and vacancy, with the latest answer", () => {
    const list = listInvitations(data({ permissions: [permit("invited", 1), permit("accepted", 2)] }), DEMO_PROFILES);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ candidateId: person.id, alias: "Candidate 1042", status: "accepted" });
  });

  it("brings the vacancy's questions, the same ones for everyone", () => {
    const questions = [{ requirement: "SQL", question: "Show a query.", strong: "s", basic: "b" }];
    const list = listInvitations(data({ permissions: [permit("invited", 1)], interviews: [{ vacancyId: DEMO_VACANCY.id, questions }] }), DEMO_PROFILES);
    expect(list[0].questions).toEqual(questions);
  });

  it("hides an invitation to a vacancy that is no longer published", () => {
    expect(listInvitations(data({ vacancies: [{ ...DEMO_VACANCY, status: "draft" }], permissions: [permit("invited", 1)] }), DEMO_PROFILES)).toEqual([]);
    expect(listInvitations(data({ vacancies: [], permissions: [permit("invited", 1)] }), DEMO_PROFILES)).toEqual([]);
  });

  it("counts only the invitations still waiting for an answer", () => {
    expect(waitingInvitations(data({ permissions: [permit("invited", 1)] }), DEMO_PROFILES)).toBe(1);
    expect(waitingInvitations(data({ permissions: [permit("invited", 1), permit("declined", 2)] }), DEMO_PROFILES)).toBe(0);
  });
});

describe("addInterviewStep", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) });
  });

  it("adds a step to My plan that leads to the questions, and reports the application", () => {
    addInterviewStep("Ceiba Foods");
    const plan = loadPlan();
    expect(plan.steps.find((s) => s.href === "/invitations")).toMatchObject({ title: "Read your interview questions for Ceiba Foods", stage: "interview", source: "module" });
    expect(plan.events?.map((e) => e.type)).toEqual(["application-sent"]);
  });

  it("adds it once, even after a no and a second yes", () => {
    addInterviewStep("Ceiba Foods");
    addInterviewStep("Ceiba Foods");
    expect(loadPlan().steps.filter((s) => s.href === "/invitations")).toHaveLength(1);
    expect(loadPlan().events).toHaveLength(1);
  });
});
