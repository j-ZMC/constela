// Constela for Employers: what an invited candidate sees. See SPEC-employers.md.
import type { InterviewQuestion } from "@/lib/employer-ai";
import type { Booking, EmployerData } from "@/lib/employer-store";
import { addStepToPlan, loadPlan, markEvent } from "@/lib/plan";
import type { Vacancy } from "@/lib/vacancy";
import { anonymize, latestPermission, type Permission, type WorkProfile } from "@/lib/work-profile";

export type Invitation = {
  candidateId: string;
  alias: string;
  vacancy: Vacancy;
  status: Permission["status"];
  booking?: Booking;
  questions: InterviewQuestion[];
};

// shortcut: one browser holds every demo candidate, so this lists all invitations; with accounts a person sees only their own.
export function listInvitations(data: EmployerData, profiles: WorkProfile[]): Invitation[] {
  const pairs = new Map(data.permissions.map((p) => [`${p.candidateId}|${p.vacancyId}`, p]));
  return [...pairs.values()].flatMap(({ candidateId, vacancyId }) => {
    const vacancy = data.vacancies.find((v) => v.id === vacancyId && v.status === "published");
    const profile = profiles.find((p) => p.id === candidateId);
    const status = latestPermission(data.permissions, candidateId, vacancyId)?.status;
    if (!vacancy || !profile || !status) return [];
    return [
      {
        candidateId,
        alias: anonymize(profile).alias,
        vacancy,
        status,
        booking: data.bookings.find((b) => b.candidateId === candidateId && b.vacancyId === vacancyId),
        questions: data.interviews.find((i) => i.vacancyId === vacancyId)?.questions ?? [],
      },
    ];
  });
}

export const waitingInvitations = (data: EmployerData, profiles: WorkProfile[]) => listInvitations(data, profiles).filter((i) => i.status === "invited").length;

// Once per employer: saying yes, no and yes again doesn't fill My plan with copies.
export function addInterviewStep(company: string): void {
  const title = `Read your interview questions for ${company}`.slice(0, 80);
  if (loadPlan().steps.some((s) => s.title === title)) return;
  addStepToPlan({ title, minutes: 15, icon: "message", href: "/invitations", stage: "interview" });
  markEvent("application-sent");
}
