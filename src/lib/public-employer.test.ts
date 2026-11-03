import { describe, expect, it } from "vitest";
import { EMPTY_SNAPSHOT, publicSeal, publicSnapshot, publicSnapshotSchema, publicVacancy, type PublicSnapshot } from "@/lib/public-employer";
import { DEMO_VACANCY, type Vacancy } from "@/lib/vacancy";

const now = new Date("2026-11-02T12:00:00.000Z");
const later = new Date("2026-11-10T12:00:00.000Z");
const answered = { dueAt: "2026-11-05T12:00:00.000Z", answeredAt: "2026-11-01T12:00:00.000Z" };
const owed = { dueAt: "2026-11-05T12:00:00.000Z" };
const draft: Vacancy = { ...DEMO_VACANCY, id: "v-draft", status: "draft", title: "Hidden Draft" };
const snapshot = (change: Partial<PublicSnapshot> = {}): PublicSnapshot => ({ vacancies: [DEMO_VACANCY], guideRead: true, responses: [answered], ...change });

describe("publicSnapshot", () => {
  it("keeps published job posts only", () => {
    expect(publicSnapshot({ vacancies: [DEMO_VACANCY, draft], guideRead: false, responses: [] }).vacancies).toEqual([DEMO_VACANCY]);
  });

  it("keeps the dates of an answer and never who it was for", () => {
    const sent = publicSnapshot({ vacancies: [], guideRead: true, responses: [{ ...answered, candidateId: "c-1042", vacancyId: "v-1" }] });
    expect(sent.responses).toEqual([answered]);
    expect(JSON.stringify(sent)).not.toContain("c-1042");
  });

  it("passes its own check, once it has been through JSON", () => {
    const sent = publicSnapshot({ vacancies: [DEMO_VACANCY], guideRead: true, responses: [answered, owed] });
    expect(publicSnapshotSchema.safeParse(JSON.parse(JSON.stringify(sent))).success).toBe(true);
  });
});

describe("publicSnapshotSchema", () => {
  const accepts = (value: unknown) => publicSnapshotSchema.safeParse(value).success;

  it("accepts an empty snapshot", () => {
    expect(accepts(EMPTY_SNAPSHOT)).toBe(true);
  });

  it("refuses a draft, because only what is published is public", () => {
    expect(accepts(snapshot({ vacancies: [draft] }))).toBe(false);
  });

  it("refuses a candidate id, even next to valid dates", () => {
    expect(accepts({ ...snapshot(), responses: [{ ...answered, candidateId: "c-1042" }] })).toBe(false);
  });

  it("refuses any other field, such as a stored level or a name", () => {
    expect(accepts({ ...snapshot(), level: "gold" })).toBe(false);
    expect(accepts({ ...snapshot(), permissions: [] })).toBe(false);
    expect(accepts({ ...snapshot(), vacancies: [{ ...DEMO_VACANCY, name: "Maya" }] })).toBe(false);
  });

  it("refuses a date that isn't one, and more than it can hold", () => {
    expect(accepts({ ...snapshot(), responses: [{ dueAt: "soon" }] })).toBe(false);
    expect(accepts({ ...snapshot(), vacancies: Array.from({ length: 51 }, () => DEMO_VACANCY) })).toBe(false);
    expect(accepts({ ...snapshot(), responses: Array.from({ length: 501 }, () => owed) })).toBe(false);
  });
});

describe("publicSeal", () => {
  it("names the level and the job posts of a company", () => {
    expect(publicSeal(snapshot(), "Ceiba Foods", now)).toEqual({ company: "Ceiba Foods", level: "silver", vacancyIds: [DEMO_VACANCY.id] });
  });

  it("finds a company whatever its capitals or spaces, and answers with its real name", () => {
    expect(publicSeal(snapshot(), "  ceiba FOODS ", now).company).toBe("Ceiba Foods");
  });

  it("says no seal for a company it doesn't know, and repeats the name asked", () => {
    expect(publicSeal(snapshot(), "Other Foods", now)).toEqual({ company: "Other Foods", level: null, vacancyIds: [] });
  });

  it("drops as soon as a promised date passes, with nothing written", () => {
    const waiting = snapshot({ responses: [answered, owed] });
    expect(publicSeal(waiting, "Ceiba Foods", now).level).toBe("silver");
    expect(publicSeal(waiting, "Ceiba Foods", later).level).toBe("bronze");
  });

  it("gives no seal while the guide is unread", () => {
    expect(publicSeal(snapshot({ guideRead: false }), "Ceiba Foods", now).level).toBeNull();
  });

  it("counts published job posts only", () => {
    expect(publicSeal(snapshot({ vacancies: [] }), "Ceiba Foods", now).vacancyIds).toEqual([]);
  });
});

describe("publicVacancy", () => {
  it("shows what candidates read, with the seal of the moment", () => {
    const card = publicVacancy(snapshot(), DEMO_VACANCY.id, now);
    expect(card).toMatchObject({ id: DEMO_VACANCY.id, company: "Ceiba Foods", title: "Junior Data Analyst", seal: "silver", essential: ["Write basic SQL queries", "Use Excel formulas and pivot tables", "Build simple charts and dashboards"] });
    expect(card?.environment).toContain("Quiet place to work");
    expect(publicVacancy(snapshot({ responses: [answered, owed] }), DEMO_VACANCY.id, later)?.seal).toBe("bronze");
  });

  it("leaves out what is only for the employer, even a field added later", () => {
    const extended = { ...DEMO_VACANCY, internalNote: "Prefer young people" } as Vacancy;
    const text = JSON.stringify(publicVacancy(snapshot({ vacancies: [extended] }), DEMO_VACANCY.id, now));
    expect(text).not.toContain("internalNote");
    expect(text).not.toContain("published");
    expect(text).not.toContain("power_bi");
  });

  it("leaves out a field added later to a hiring step", () => {
    const process = [{ ...DEMO_VACANCY.process[0], interviewerNote: "Private" }];
    expect(JSON.stringify(publicVacancy(snapshot({ vacancies: [{ ...DEMO_VACANCY, process }] }), DEMO_VACANCY.id, now))).not.toContain("interviewerNote");
  });

  it("finds nothing for an unknown id", () => {
    expect(publicVacancy(snapshot(), "v-unknown", now)).toBeNull();
  });
});
