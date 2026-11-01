// Constela for Employers: the structured interview. See SPEC-employers.md.
// Questions belong to the vacancy, so everyone gets the same ones. Candidates read them 48 hours before.
import type { InterviewQuestion } from "@/lib/employer-ai";

const NOTICE_MS = 48 * 60 * 60 * 1000;

export type QuestionFlag = { id: string; problem: string; blocks: boolean };

// Personal questions block saving: they have no place in an interview. The others only warn, because the employer may know
// better. Each pattern reads what is asked of the person, so a job about "health records" isn't flagged.
const CHECKS = [
  {
    id: "personal",
    pattern:
      /\bhow old are you\b|\byour (?:age|health|family|children|kids|religion|disability|diagnosis|medication|condition)\b|\bare you (?:married|pregnant|disabled|autistic|neurodivergent)\b|\bdo you have (?:children|kids|a disability|a diagnosis|a condition)\b|\bplan(?:ning)? to have (?:children|kids)\b/i,
    blocks: true,
    problem: "This asks about the person, not the job. Take it out.",
  },
  {
    id: "hypothetical",
    pattern: /\bwhat would you\b|\bhow would you\b|\bwould you\b|\bimagine\b|\bsuppose\b|\bwhat if\b|\bif you (?:were|had)\b/i,
    blocks: false,
    problem: "This asks about an imagined situation. Ask about real work instead.",
  },
  {
    id: "vague",
    pattern: /\btell (?:me|us) about yourself\b|\bdescribe yourself\b|\bwhy should we hire\b|\bwhere do you see yourself\b|\bstrengths?\b|\bweakness(?:es)?\b|\bwhat motivates you\b|\bwhy do you want\b|\bgood fit\b/i,
    blocks: false,
    problem: "This is vague and doesn't show how the person works. Ask about a real task.",
  },
] as const;

export function checkQuestion(question: string): QuestionFlag[] {
  return CHECKS.filter((c) => c.pattern.test(question)).map(({ id, problem, blocks }) => ({ id, problem, blocks }));
}

export const concreteQuestion = (requirement: string) => `Tell us about a real task that used this: ${requirement}.`;

// Works with no AI at all: one question per essential requirement.
export function templateQuestions(essential: string[]): InterviewQuestion[] {
  return essential.map((requirement) => ({
    requirement,
    question: concreteQuestion(requirement),
    strong: "Says what they did, how they did it and what came out of it.",
    basic: "Says what they did, with few details.",
  }));
}

export function questionProblems(questions: InterviewQuestion[]): string[] {
  const blank = questions.some((q) => !q.question.trim() || !q.strong.trim() || !q.basic.trim());
  const personal = questions.some((q) => checkQuestion(q.question).some((f) => f.blocks));
  return [...(blank ? ["Fill in every question and both rubric lines."] : []), ...(personal ? ["Take out the questions about the person."] : [])];
}

export const opensAt = (interviewAt: string) => new Date(Date.parse(interviewAt) - NOTICE_MS);
export const questionsOpen = (interviewAt: string, now: Date) => now >= opensAt(interviewAt);

// What <input type="datetime-local"> needs: the person's own clock, not UTC.
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
