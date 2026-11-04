import { describe, expect, it } from "vitest";
import { CHECKS, isComplete, isEnglish, plain, postingKey, readPosting, readingGrade, syllables, type Check, type Posting } from "./postings";

const posting = (description: string, change: Partial<Posting> = {}): Posting => ({
  title: "Data Analyst",
  company: "Acme",
  modality: "",
  salary_min: null,
  salary_max: null,
  description,
  source: "greenhouse",
  ...change,
});
const finds = (check: Check, text: string) => CHECKS[check].test(text);

describe("the checks", () => {
  it.each([
    "The base salary range for this role is $120,000 - $150,000.",
    "Compensation: $95k to $110k plus equity.",
    "Pay is $45/hr.",
    "USD 30 per hour",
    "$196,000 — $245,000 USD",
    "Pay Rate: $40?$55/hour",
  ])("finds pay in %j", (text) => expect(finds("pay", text)).toBe(true));

  it.each(["We raised $20M from top investors.", "Our customers save $1,000 a year on average spend.", "Competitive salary and benefits."])(
    "finds no pay in %j",
    (text) => expect(finds("pay", text)).toBe(false),
  );

  it("finds a work mode, a schedule and the length of a hiring step", () => {
    expect(finds("workMode", "This is a hybrid role in Austin.")).toBe(true);
    expect(finds("workMode", "Join our team in Austin.")).toBe(false);
    expect(finds("schedule", "Monday to Friday, 9 am to 5 pm.")).toBe(true);
    expect(finds("schedule", "40 hours per week")).toBe(true);
    expect(finds("schedule", "A full-time role.")).toBe(false);
    expect(finds("stepLength", "First, a 30-minute call with a recruiter.")).toBe(true);
    expect(finds("stepLength", "The interview lasts 45 minutes.")).toBe(true);
    expect(finds("stepLength", "We have a short interview process.")).toBe(false);
    expect(finds("stepLength", "Respond to failures within 60 minutes while on scheduled on-call.")).toBe(false);
  });

  it("finds a promise of when the answer comes", () => {
    expect(finds("answerTime", "We will get back to you within 5 business days.")).toBe(true);
    expect(finds("answerTime", "Expect to hear back in two weeks.")).toBe(true);
    expect(finds("answerTime", "We review applications on a rolling basis.")).toBe(false);
  });

  it("finds adjustments, even in a legal sentence", () => {
    expect(finds("accommodation", "We provide reasonable accommodations to applicants.")).toBe(true);
    expect(finds("accommodation", "We value inclusion.")).toBe(false);
  });
});

describe("readPosting", () => {
  it("takes pay and work mode from the fields too", () => {
    const reading = readPosting(posting("A role.", { salary_min: 90000, modality: "remote" }));
    expect(reading.checks.pay).toBe(true);
    expect(reading.checks.workMode).toBe(true);
  });

  it("gives the highest score the posting could get", () => {
    expect(readPosting(posting("Analyze data.")).clarityAtBest).toBe(50); // no pay, schedule, mode, steps or adjustments: 100 - 50
    const full = "Pay is $45/hr. Remote. Monday to Friday. A 30-minute call with the team. We reply within 3 days. We offer reasonable accommodations.";
    expect(readPosting(posting(full)).clarityAtBest).toBe(100);
  });

  it("needs both the length of a step and the answer time for the hiring part", () => {
    const steps = "Pay is $45/hr. Remote. Monday to Friday. We offer reasonable accommodations. A 30-minute call with the team.";
    expect(readPosting(posting(steps)).clarityAtBest).toBe(90);
  });

  it("takes 5 points for each vague phrase, up to 20", () => {
    const reading = readPosting(posting("Fast-paced, dynamic team of rockstar self-starters who multitask under pressure."));
    expect(reading.vague.length).toBeGreaterThanOrEqual(5);
    expect(reading.clarityAtBest).toBe(30);
  });
});

describe("cleaning", () => {
  it("strips HTML and entities", () => {
    expect(plain("<p>Fast&nbsp;paced &amp; fun</p>")).toBe("Fast paced & fun");
  });

  it("knows a posting the collector cut", () => {
    expect(isComplete(posting("x".repeat(3999)))).toBe(false);
    expect(isComplete(posting("x".repeat(2000)))).toBe(true);
  });

  it("finds the same posting from two boards", () => {
    expect(postingKey(posting("Same text", { source: "dice" }))).toBe(postingKey(posting("Same text", { source: "lever" })));
  });

  it("keeps English and leaves out other languages", () => {
    expect(isEnglish("You will work with our team on the data and the reports.")).toBe(true);
    expect(isEnglish("Buscamos una persona para el equipo de datos con experiencia.")).toBe(false);
  });
});

describe("reading grade", () => {
  // A rule of thumb, as in most readability tools: it says 3 for "experience", which has 4, so the grade is an estimate.
  it("counts syllables by vowel groups", () => {
    expect([syllables("data"), syllables("analyst"), syllables("the"), syllables("report"), syllables("dashboards")]).toEqual([2, 3, 1, 2, 2]);
  });

  it("reads short, plain sentences as easy and long, dense ones as hard", () => {
    const easy = readingGrade("You pull the sales data. You make a short report. You send it on Friday.") ?? 99;
    const hard = readingGrade("The successful candidate will demonstrate exceptional organizational capabilities, leveraging comprehensive analytical methodologies to operationalize cross-functional initiatives.") ?? 0;
    expect(easy).toBeLessThan(4);
    expect(hard).toBeGreaterThan(16);
  });

  it("leaves out run-on lists that lost their line breaks", () => {
    expect(readingGrade(`${"word ".repeat(60)}.`)).toBeNull();
  });
});
