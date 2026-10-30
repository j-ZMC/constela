import { describe, expect, it } from "vitest";
import {
  CLARITY_VERSION,
  DEMO_VACANCY,
  EXCLUSIONARY_PHRASES,
  clarityScore,
  findExclusionaryPhrases,
  offersAlternativeFormat,
  vacancySchema,
  type Vacancy,
} from "@/lib/vacancy";

describe("vacancy schema", () => {
  it("accepts the demo vacancy", () => {
    expect(vacancySchema.safeParse(DEMO_VACANCY).success).toBe(true);
  });

  it("rejects unknown fields, unknown skills and a salary range upside down", () => {
    expect(vacancySchema.safeParse({ ...DEMO_VACANCY, idealAge: "25-35" }).success).toBe(false);
    expect(vacancySchema.safeParse({ ...DEMO_VACANCY, essential: [{ text: "Juggling", skill: "juggling" }] }).success).toBe(false);
    expect(vacancySchema.safeParse({ ...DEMO_VACANCY, salary: { ...DEMO_VACANCY.salary, min: 30000 } }).success).toBe(false);
  });
});

describe("clarityScore", () => {
  it("gives a complete vacancy 100 with no issues, and says which rules it used", () => {
    expect(clarityScore(DEMO_VACANCY)).toEqual({ version: CLARITY_VERSION, score: 100, issues: [] });
  });

  const cases: [string, Partial<Vacancy>, number][] = [
    ["salary", { salary: undefined }, 15],
    ["tasks", { tasks: ["Pull sales data", "Update the dashboard"] }, 10],
    ["schedule", { schedule: undefined }, 10],
    ["modality", { modality: undefined }, 10],
    ["essential", { essential: Array.from({ length: 6 }, (_, i) => ({ text: `Requirement ${i + 1}` })) }, 10],
    ["environment", { environment: undefined }, 10],
    ["process", { responseDays: undefined }, 10],
    ["process", { process: [{ name: "Interview", format: "video-call" }] }, 10],
    ["process", { process: [] }, 10],
    ["accommodations", { accommodations: [] }, 5],
  ];

  it.each(cases)("deducts for %s", (id, change, points) => {
    const { score, issues } = clarityScore({ ...DEMO_VACANCY, ...change });
    expect(score).toBe(100 - points);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ id, points });
    expect(issues[0].fix.length).toBeGreaterThan(0);
  });

  it("counts an empty environment as described: the job honestly offers none of the list", () => {
    expect(clarityScore({ ...DEMO_VACANCY, environment: [] }).score).toBe(100);
  });

  it("deducts 5 per vague phrase up to 20, and still lists the phrases past the cap", () => {
    const summary = "A fast-paced, dynamic team needs a self-starter and team player who can multitask under pressure.";
    const { score, issues } = clarityScore({ ...DEMO_VACANCY, summary });
    expect(issues).toHaveLength(6);
    expect(issues.every((i) => i.id.startsWith("phrase:"))).toBe(true);
    expect(issues.map((i) => i.points)).toEqual([5, 5, 5, 5, 0, 0]);
    expect(score).toBe(80);
  });

  it("never goes below 0: all deductions add up to 100", () => {
    const worst: Vacancy = {
      ...DEMO_VACANCY,
      title: "Rockstar analyst",
      summary: "Fast-paced. Team player. Self-starter. Culture fit.",
      tasks: [],
      essential: Array.from({ length: 6 }, (_, i) => ({ text: `Requirement ${i + 1}` })),
      salary: undefined,
      schedule: undefined,
      modality: undefined,
      environment: undefined,
      accommodations: [],
      process: [],
      responseDays: undefined,
    };
    expect(clarityScore(worst).score).toBe(0);
  });
});

describe("findExclusionaryPhrases", () => {
  it("finds common vague phrases and keeps the exact words for highlighting", () => {
    const text = "Join our Fast-Paced environment. You have excellent written and verbal communication and are a team player.";
    expect(findExclusionaryPhrases(text).map((p) => [p.id, p.match])).toEqual([
      ["fast-paced", "Fast-Paced"],
      ["team-player", "team player"],
      ["communication", "excellent written and verbal communication"],
    ]);
  });

  it("does not flag concrete tasks that share words with a vague phrase", () => {
    const text = [
      "Make outgoing calls to suppliers",
      "Set up dynamic pricing rules",
      "Strong understanding of communication protocols",
      "Answer 20 customer emails a day",
    ].join("\n");
    expect(findExclusionaryPhrases(text)).toEqual([]);
  });

  it("gives every phrase a hint for the rewrite", () => {
    expect(EXCLUSIONARY_PHRASES.every((p) => p.hint.length > 0)).toBe(true);
  });
});

describe("offersAlternativeFormat", () => {
  it("is true for a written, work-sample or paid stage, or a stage with another format to choose", () => {
    expect(offersAlternativeFormat(DEMO_VACANCY)).toBe(true);
    expect(offersAlternativeFormat({ ...DEMO_VACANCY, process: [{ name: "Call", format: "video-call" }] })).toBe(false);
    expect(
      offersAlternativeFormat({ ...DEMO_VACANCY, process: [{ name: "Call", format: "video-call", alternative: "written" }] }),
    ).toBe(true);
  });
});
