// The short summary of the person's CV and plan that the interview AI may use. Built in the browser from what is
// already saved on this device. Never the name, email or phone from the CV.
import type { InterviewContext } from "@/lib/interview";
import { loadResumeProfile } from "@/lib/local-profile";
import { activeSteps, branchName, branchProgress, currentBranch } from "@/lib/path";
import { BRANCHES, loadPlan, type Plan } from "@/lib/plan";
import type { ResumeProfile } from "@/lib/resume";
import type { SavedJob } from "@/lib/saved-jobs";

// One line each, cut to the sizes the server accepts.
const clip = (items: readonly string[], count: number, max: number) =>
  items.map((s) => s.replace(/\s+/g, " ").trim().slice(0, max).trim()).filter(Boolean).slice(0, count);

export function buildInterviewContext(cv: ResumeProfile | null, plan: Plan | null): InterviewContext {
  const context: InterviewContext = {};
  if (cv) {
    const summary = {
      skills: clip(cv.skills_found, 40, 120),
      sectors: clip(cv.sectors, 10, 120),
      experience: clip(cv.experience, 8, 300),
      projects: clip(cv.projects, 8, 300),
    };
    if (Object.values(summary).some((items) => items.length)) context.cv = summary;
  }
  // A plan gets its branches the first time My plan opens; before that there is nothing real to tell.
  if (plan?.opened) {
    // Waiting steps in the order My plan suggests them: the branch being worked on comes first.
    const next = activeSteps(plan).filter((s) => !s.done);
    const done = plan.steps.filter((s) => s.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
    const branches = BRANCHES.map((b) => {
      const { done, total } = branchProgress(plan, b);
      // Each branch's own next step, so the AI never gives one branch's step for another.
      const step = done < total ? plan.steps.find((s) => s.stage === b && !s.done) : undefined;
      return `${branchName(b)}: ${done} of ${total} steps done${step ? `, next: ${step.title}` : ""}`;
    });
    context.plan = { branch: currentBranch(plan) ?? "own", branches: clip(branches, 8, 160), next: clip(next.map((s) => s.title), 5, 80), done: clip(done.map((s) => s.title), 10, 80) };
  }
  return context;
}

// A saved job for the interview AI: the start of its posting and the web search lines that found something.
export function buildJobContext(saved: SavedJob): NonNullable<InterviewContext["job"]> {
  const flat = (s: string) => s.replace(/\s+/g, " ").trim();
  return {
    company: flat(saved.job.company).slice(0, 100) || "the company",
    title: flat(saved.job.title).slice(0, 160) || "the job",
    // What the posting asks for first: the interviewer can ask about it, and it survives the cut.
    posting: flat([
      saved.posting?.required.length ? `It asks for: ${saved.posting.required.join("; ")}.` : "",
      saved.job.description,
    ].join(" ")).slice(0, 800).trim(),
    research: clip((saved.research?.facts ?? []).filter((fact) => !/not found\.?$/i.test(fact)), 6, 400),
  };
}

export function loadInterviewContext(): InterviewContext {
  return buildInterviewContext(loadResumeProfile(), loadPlan());
}
