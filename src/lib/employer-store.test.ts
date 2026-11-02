import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addPermission,
  answerInvitation,
  chooseFormat,
  employerStore,
  loadEmployerData,
  markAnswerSent,
  markGuideRead,
  saveEmployerData,
  saveInterview,
  saveVacancy,
  scheduleInterview,
  type EmployerData,
} from "@/lib/employer-store";
import { DEMO_VACANCY } from "@/lib/vacancy";
import type { Permission } from "@/lib/work-profile";

const EMPTY: EmployerData = { vacancies: [], permissions: [], responses: [], guideRead: false, interviews: [], bookings: [] };
const permission: Permission = { candidateId: "c-1", vacancyId: DEMO_VACANCY.id, status: "accepted", at: "2026-11-01T10:00:00.000Z" };
const response = { dueAt: "2026-11-01T00:00:00.000Z", answeredAt: "2026-10-31T09:00:00.000Z" };
const interview = { vacancyId: DEMO_VACANCY.id, questions: [{ requirement: "SQL", question: "Show a query.", strong: "Explains it.", basic: "Shows it." }] };
const booking: EmployerData["bookings"][number] = { candidateId: "c-1", vacancyId: DEMO_VACANCY.id, interviewAt: "2026-11-05T10:00:00.000Z", choices: [{ stage: "Meet the data team", format: "written" }] };
const data: EmployerData = { vacancies: [DEMO_VACANCY], permissions: [permission], responses: [response], guideRead: true, interviews: [interview], bookings: [booking] };

describe("employer store", () => {
  let store: Record<string, string>;
  const saved = (value: unknown) => {
    store.employers = JSON.stringify(value);
  };

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    });
  });

  it("starts empty when nothing is saved", () => {
    expect(loadEmployerData()).toEqual(EMPTY);
  });

  it("saves and loads vacancies, permissions, responses and the guide", () => {
    expect(saveEmployerData(data)).toBe(true);
    expect(loadEmployerData()).toEqual(data);
  });

  it("keeps everything under the one key that Delete my data removes", () => {
    saveEmployerData(data);
    expect(Object.keys(store)).toEqual(["employers"]);
  });

  it("loads broken JSON as empty", () => {
    store.employers = "{broken";
    expect(loadEmployerData()).toEqual(EMPTY);
  });

  it.each([[0], [2], ["1"], [undefined]])("loads version %s as empty", (version) => {
    saved({ ...data, version });
    expect(loadEmployerData()).toEqual(EMPTY);
  });

  it.each([[null], [5], ["text"], [[data]]])("loads %j as empty", (value) => {
    saved(value);
    expect(loadEmployerData()).toEqual(EMPTY);
  });

  it("loads a list that isn't a list as empty and keeps the rest", () => {
    saved({ version: 1, ...data, vacancies: "none", permissions: {} });
    expect(loadEmployerData()).toEqual({ ...data, vacancies: [], permissions: [] });
  });

  it("drops only the broken items, so one bad item doesn't lose the others", () => {
    saved({
      version: 1,
      vacancies: [DEMO_VACANCY, { id: "no-title" }, null],
      permissions: [permission, { ...permission, status: "maybe" }, "text"],
      responses: [response, { answeredAt: response.answeredAt }],
      guideRead: true,
    });
    expect(loadEmployerData()).toEqual({ ...data, interviews: [], bookings: [] });
  });

  it("drops a time that isn't ISO, which could otherwise win as the latest answer", () => {
    saved({ version: 1, ...EMPTY, permissions: [{ ...permission, at: "zzz" }], responses: [{ dueAt: "soon" }] });
    expect(loadEmployerData()).toEqual(EMPTY);
  });

  it("drops an item with a field the schema doesn't know", () => {
    const diagnosis = "autism";
    saved({
      version: 1,
      ...EMPTY,
      vacancies: [{ ...DEMO_VACANCY, diagnosis }],
      permissions: [{ ...permission, diagnosis }],
      responses: [{ ...response, diagnosis }],
    });
    expect(loadEmployerData()).toEqual(EMPTY);
  });

  it("counts the guide as read only when it is exactly true", () => {
    saved({ version: 1, ...EMPTY, guideRead: "yes" });
    expect(loadEmployerData().guideRead).toBe(false);
  });

  it("adds a new vacancy and replaces a saved one in place", () => {
    const other = { ...DEMO_VACANCY, id: "other" };
    saveVacancy(DEMO_VACANCY);
    saveVacancy(other);
    saveVacancy({ ...DEMO_VACANCY, title: "Senior Data Analyst" });
    expect(loadEmployerData().vacancies.map((v) => [v.id, v.title])).toEqual([
      [DEMO_VACANCY.id, "Senior Data Analyst"],
      ["other", DEMO_VACANCY.title],
    ]);
  });

  it("leaves permissions, responses and the guide alone when saving a vacancy", () => {
    saveEmployerData({ ...data, vacancies: [] });
    expect(saveVacancy(DEMO_VACANCY)).toBe(true);
    expect(loadEmployerData()).toEqual(data);
  });

  it("adds an answer after the others, so the latest can win, and leaves the rest alone", () => {
    saveEmployerData(data);
    const declined: Permission = { ...permission, status: "declined", at: "2026-11-02T10:00:00.000Z" };
    expect(addPermission(declined)).toBe(true);
    expect(loadEmployerData()).toEqual({ ...data, permissions: [permission, declined] });
  });

  it("loads data saved before interviews and bookings existed", () => {
    saved({ version: 1, vacancies: [DEMO_VACANCY], permissions: [permission], responses: [response], guideRead: true });
    expect(loadEmployerData()).toEqual({ ...data, interviews: [], bookings: [] });
  });

  it("drops a broken interview or booking and keeps the rest", () => {
    saved({ ...data, version: 1, interviews: [interview, { vacancyId: "x", questions: [] }], bookings: [booking, { ...booking, interviewAt: "soon" }] });
    expect(loadEmployerData()).toEqual(data);
  });

  describe("after an invitation", () => {
    const now = new Date("2026-11-01T10:00:00.000Z");
    const later = new Date("2026-11-03T10:00:00.000Z");
    const yes = () => answerInvitation("c-1", DEMO_VACANCY, "accepted", now);
    const no = () => answerInvitation("c-1", DEMO_VACANCY, "declined", later);

    it("records a yes and the answer the employer now owes, by the date the vacancy promised", () => {
      expect(yes()).toBe(true);
      const { permissions, responses } = loadEmployerData();
      expect(permissions.at(-1)).toMatchObject({ candidateId: "c-1", status: "accepted" });
      expect(responses).toEqual([{ candidateId: "c-1", vacancyId: DEMO_VACANCY.id, dueAt: "2026-11-06T10:00:00.000Z" }]);
    });

    it("owes one answer, even after a no and a second yes", () => {
      yes();
      yes();
      expect(loadEmployerData().responses).toHaveLength(1);
    });

    it("promises nothing when the vacancy gave no answer time", () => {
      answerInvitation("c-1", { ...DEMO_VACANCY, responseDays: undefined }, "accepted", now);
      expect(loadEmployerData().responses).toEqual([]);
    });

    it("cancels an answer not sent yet when the person says no, so it never counts against the seal", () => {
      yes();
      no();
      expect(loadEmployerData().responses).toEqual([]);
      expect(loadEmployerData().permissions.at(-1)?.status).toBe("declined");
    });

    it("keeps an answer already sent when the person says no", () => {
      yes();
      markAnswerSent("c-1", DEMO_VACANCY.id, now);
      no();
      expect(loadEmployerData().responses[0].answeredAt).toBe(now.toISOString());
    });

    it("marks only that person's answer as sent", () => {
      yes();
      answerInvitation("c-2", DEMO_VACANCY, "accepted", now);
      markAnswerSent("c-1", DEMO_VACANCY.id, later);
      expect(loadEmployerData().responses.map((r) => [r.candidateId, r.answeredAt])).toEqual([
        ["c-1", later.toISOString()],
        ["c-2", undefined],
      ]);
    });

    it("sets and clears the interview time, one booking per person and vacancy", () => {
      scheduleInterview("c-1", DEMO_VACANCY.id, "2026-11-05T10:00:00.000Z");
      scheduleInterview("c-1", DEMO_VACANCY.id, "2026-11-06T10:00:00.000Z");
      expect(loadEmployerData().bookings).toEqual([{ candidateId: "c-1", vacancyId: DEMO_VACANCY.id, interviewAt: "2026-11-06T10:00:00.000Z", choices: [] }]);
      scheduleInterview("c-1", DEMO_VACANCY.id, undefined);
      expect(loadEmployerData().bookings[0].interviewAt).toBeUndefined();
    });

    it("keeps one format per step, and clears it to go back to the plan", () => {
      chooseFormat("c-1", DEMO_VACANCY.id, "Meet the team", "written");
      chooseFormat("c-1", DEMO_VACANCY.id, "Meet the team", "work-sample");
      expect(loadEmployerData().bookings[0].choices).toEqual([{ stage: "Meet the team", format: "work-sample" }]);
      chooseFormat("c-1", DEMO_VACANCY.id, "Meet the team", undefined);
      expect(loadEmployerData().bookings[0].choices).toEqual([]);
    });

    it("keeps the time when a format is chosen", () => {
      scheduleInterview("c-1", DEMO_VACANCY.id, "2026-11-05T10:00:00.000Z");
      chooseFormat("c-1", DEMO_VACANCY.id, "Meet the team", "written");
      expect(loadEmployerData().bookings[0].interviewAt).toBe("2026-11-05T10:00:00.000Z");
    });
  });

  it("keeps one list of questions per vacancy, so everyone gets the same ones", () => {
    saveInterview(interview);
    saveInterview({ ...interview, questions: [{ ...interview.questions[0], question: "Show another query." }] });
    expect(loadEmployerData().interviews).toHaveLength(1);
    expect(loadEmployerData().interviews[0].questions[0].question).toBe("Show another query.");
  });

  it("remembers the guide was read and leaves the rest alone", () => {
    saveEmployerData({ ...data, guideRead: false });
    expect(markGuideRead()).toBe(true);
    expect(loadEmployerData()).toEqual(data);
  });

  it("gives the same snapshot until the data changes, as React needs", () => {
    saveEmployerData(data);
    const first = employerStore.snapshot();
    expect(employerStore.snapshot()).toBe(first);
    saveVacancy({ ...DEMO_VACANCY, title: "Changed" });
    expect(employerStore.snapshot()).not.toBe(first);
    expect(employerStore.snapshot().vacancies[0].title).toBe("Changed");
  });

  it("tells open pages about a save here and in another tab, until they stop listening", () => {
    const tabs = new EventTarget();
    vi.stubGlobal("window", tabs);
    const listener = vi.fn();
    const stop = employerStore.subscribe(listener);

    saveEmployerData(data);
    tabs.dispatchEvent(new Event("storage"));
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    saveEmployerData(data);
    tabs.dispatchEvent(new Event("storage"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("loads empty and reports a failed save when the browser blocks storage", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    expect(loadEmployerData()).toEqual(EMPTY);
    expect(saveEmployerData(data)).toBe(false);
    expect(saveVacancy(DEMO_VACANCY)).toBe(false);
    expect(addPermission(permission)).toBe(false);
    expect(employerStore.snapshot()).toEqual(EMPTY);
  });
});
