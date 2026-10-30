import { describe, expect, it } from "vitest";
import { computeSeal, type SealInput } from "@/lib/seal";
import { DEMO_VACANCY, type Vacancy } from "@/lib/vacancy";

const now = new Date("2026-11-01T12:00:00.000Z");
const onTime = { dueAt: "2026-11-01T00:00:00.000Z", answeredAt: "2026-10-31T09:00:00.000Z" };
// Clear (score 100), but every stage is a call: no alternative interview format.
const plain: Vacancy = { ...DEMO_VACANCY, accommodations: ["Flexible start time"], process: [{ name: "Interview", format: "video-call", minutes: 30 }] };
const unclear: Vacancy = { ...DEMO_VACANCY, salary: undefined, schedule: undefined };

const input = (change: Partial<SealInput> = {}): SealInput => ({
  vacancies: [DEMO_VACANCY],
  guideRead: true,
  responses: [onTime],
  ratings: [],
  ...change,
});

describe("computeSeal", () => {
  it("gives no seal before anything is published", () => {
    const seal = computeSeal(input({ vacancies: [{ ...DEMO_VACANCY, status: "draft" }] }), now);
    expect(seal.level).toBeNull();
    expect(seal.checks.find((c) => c.id === "clarity")?.detail).toContain("0 of 0");
  });

  it("gives bronze for clear vacancies and the guide read", () => {
    expect(computeSeal(input({ vacancies: [plain], responses: [] }), now).level).toBe("bronze");
    expect(computeSeal(input({ vacancies: [plain], guideRead: false }), now).level).toBeNull();
  });

  it("gives silver once vacancies offer adjustments and another format and answers arrive on time", () => {
    expect(computeSeal(input(), now).level).toBe("silver");
    expect(computeSeal(input({ responses: [] }), now).level).toBe("bronze"); // no answers yet: nothing to measure
  });

  it("gives gold only with 5 or more candidate ratings averaging 4 or more", () => {
    expect(computeSeal(input({ ratings: [5, 4, 4, 5, 4] }), now).level).toBe("gold");
    expect(computeSeal(input({ ratings: [5, 5, 5, 5] }), now).level).toBe("silver");
    expect(computeSeal(input({ ratings: [5, 4, 3, 3, 4] }), now).level).toBe("silver");
  });

  it("is lost as soon as a metric drops", () => {
    expect(computeSeal(input({ vacancies: [DEMO_VACANCY, unclear] }), now).level).toBeNull();
    const late = { dueAt: "2026-10-30T00:00:00.000Z", answeredAt: "2026-10-31T00:00:00.000Z" };
    expect(computeSeal(input({ responses: [onTime, late] }), now).level).toBe("bronze");
  });

  it("counts an unanswered response once it is overdue, and not before", () => {
    const overdue = { dueAt: "2026-10-31T00:00:00.000Z" };
    const notDueYet = { dueAt: "2026-11-03T00:00:00.000Z" };
    expect(computeSeal(input({ responses: [onTime, overdue] }), now).level).toBe("bronze");
    expect(computeSeal(input({ responses: [onTime, notDueYet] }), now).level).toBe("silver");
  });

  it("ignores drafts, so an unfinished vacancy never costs the seal", () => {
    expect(computeSeal(input({ vacancies: [DEMO_VACANCY, { ...unclear, status: "draft" }] }), now).level).toBe("silver");
  });
});
