import { beforeEach, describe, expect, it, vi } from "vitest";
import { employerStore, loadEmployerData, saveEmployerData, saveVacancy, type EmployerData } from "@/lib/employer-store";
import { DEMO_VACANCY } from "@/lib/vacancy";
import type { Permission } from "@/lib/work-profile";

const EMPTY: EmployerData = { vacancies: [], permissions: [], responses: [], guideRead: false };
const permission: Permission = { candidateId: "c-1", vacancyId: DEMO_VACANCY.id, status: "accepted", at: "2026-11-01T10:00:00.000Z" };
const response = { dueAt: "2026-11-01T00:00:00.000Z", answeredAt: "2026-10-31T09:00:00.000Z" };
const data: EmployerData = { vacancies: [DEMO_VACANCY], permissions: [permission], responses: [response], guideRead: true };

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
    expect(loadEmployerData()).toEqual(data);
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
    expect(employerStore.snapshot()).toEqual(EMPTY);
  });
});
