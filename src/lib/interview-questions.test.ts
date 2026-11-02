import { describe, expect, it } from "vitest";
import { checkQuestion, concreteQuestion, opensAt, questionProblems, questionsOpen, templateQuestions, toLocalInput } from "@/lib/interview-questions";

const flags = (question: string) => checkQuestion(question).map((f) => f.id);

describe("checkQuestion", () => {
  it.each([
    ["What would you do if a report was late?"],
    ["How would you handle a difficult customer?"],
    ["Imagine you lost a file."],
    ["Suppose the database goes down."],
    ["What if your manager disagrees?"],
  ])("flags a hypothetical question: %s", (question) => {
    expect(flags(question)).toContain("hypothetical");
  });

  it.each([["Tell me about yourself."], ["Why should we hire you?"], ["Where do you see yourself in five years?"], ["What is your greatest weakness?"], ["What are your strengths?"]])(
    "flags a vague question: %s",
    (question) => {
      expect(flags(question)).toContain("vague");
    },
  );

  it.each([["How old are you?"], ["Are you married?"], ["Do you have children?"], ["Tell us about your health."], ["Do you have a diagnosis?"]])("blocks a personal question: %s", (question) => {
    expect(checkQuestion(question).some((f) => f.blocks)).toBe(true);
  });

  it.each([
    ["Tell us about a report you built with SQL."],
    ["Show a formula you used last week."],
    ["Tell us how you kept health records up to date."], // a job about health isn't a personal question
    ["How did you manage the stock count?"],
  ])("leaves a concrete question alone: %s", (question) => {
    expect(checkQuestion(question)).toEqual([]);
  });

  it("only blocks personal questions: the employer may know better on the others", () => {
    expect(checkQuestion("What would you do if a report was late?").every((f) => !f.blocks)).toBe(true);
    expect(checkQuestion("Tell me about yourself.").every((f) => !f.blocks)).toBe(true);
  });
});

describe("the fixed questions", () => {
  it("gives one question per essential requirement, with a rubric, and needs no AI", () => {
    const questions = templateQuestions(["Basic SQL", "Excel formulas"]);
    expect(questions.map((q) => q.requirement)).toEqual(["Basic SQL", "Excel formulas"]);
    expect(questions.every((q) => q.question && q.strong && q.basic)).toBe(true);
  });

  it("passes its own checker", () => {
    expect(checkQuestion(concreteQuestion("Basic SQL"))).toEqual([]);
    expect(questionProblems(templateQuestions(["Basic SQL"]))).toEqual([]);
  });
});

describe("questionProblems", () => {
  const [good] = templateQuestions(["Basic SQL"]);

  it("needs every question and both rubric lines", () => {
    expect(questionProblems([{ ...good, question: "  " }])).toHaveLength(1);
    expect(questionProblems([{ ...good, strong: "" }])).toHaveLength(1);
    expect(questionProblems([{ ...good, basic: "" }])).toHaveLength(1);
  });

  it("stops a personal question and lets a warned one through", () => {
    expect(questionProblems([{ ...good, question: "How old are you?" }])).toEqual(["Take out the questions about the person."]);
    expect(questionProblems([{ ...good, question: "What would you do if a report was late?" }])).toEqual([]);
  });
});

describe("48 hours before", () => {
  const interview = "2026-11-10T10:00:00.000Z";

  it("opens the questions exactly 48 hours before", () => {
    expect(opensAt(interview).toISOString()).toBe("2026-11-08T10:00:00.000Z");
    expect(questionsOpen(interview, new Date("2026-11-08T09:59:59.000Z"))).toBe(false);
    expect(questionsOpen(interview, new Date("2026-11-08T10:00:00.000Z"))).toBe(true);
  });

  it("keeps them open after the interview", () => {
    expect(questionsOpen(interview, new Date("2026-11-11T10:00:00.000Z"))).toBe(true);
  });
});

describe("toLocalInput", () => {
  it("keeps the same moment on the person's clock", () => {
    const iso = "2026-11-10T10:30:00.000Z";
    expect(toLocalInput(iso)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(toLocalInput(iso)).toISOString()).toBe(iso);
  });
});
