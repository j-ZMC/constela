import { describe, expect, it } from "vitest";
import { clarityScore, DEMO_VACANCY } from "@/lib/vacancy";
import {
  cleanVacancy,
  emptyForm,
  formFromDraft,
  formFromVacancy,
  hasBlank,
  markPhrases,
  PROCESS_TEMPLATE,
  publishProblems,
  saveProblems,
  toggleFactor,
  type VacancyForm,
} from "@/lib/vacancy-editor";

const form = (change: Partial<VacancyForm> = {}): VacancyForm => ({ ...emptyForm("v-1"), title: "Cashier", company: "Ceiba Foods", ...change });
const clean = (change: Partial<VacancyForm> = {}) => cleanVacancy(form(change));

describe("cleanVacancy", () => {
  it("drops blank rows and trims the rest", () => {
    const v = clean({
      title: "  Cashier ",
      tasks: [" Count the till ", "", "   "],
      essential: [{ text: " Basic maths ", skill: "data_entry" }, { text: " " }],
      accommodations: ["", "Flexible start time"],
    });
    expect(v.title).toBe("Cashier");
    expect(v.tasks).toEqual(["Count the till"]);
    expect(v.essential).toEqual([{ text: "Basic maths", skill: "data_entry" }]);
    expect(v.accommodations).toEqual(["Flexible start time"]);
  });

  it("treats blank optional text as not given", () => {
    const v = clean({ schedule: "  ", location: "" });
    expect(v.schedule).toBeUndefined();
    expect(v.location).toBeUndefined();
  });

  it("gives no salary when no amount is typed, and uses one amount for both ends", () => {
    expect(clean().salary).toBeUndefined();
    expect(clean({ salary: { min: 9000, currency: "MXN", period: "month" } }).salary).toEqual({ min: 9000, max: 9000, currency: "MXN", period: "month" });
    expect(clean({ salary: { max: 9000, currency: "USD", period: "hour" } }).salary).toEqual({ min: 9000, max: 9000, currency: "USD", period: "hour" });
  });

  it("drops an untouched hiring step but keeps one with any detail, so the employer is told to finish it", () => {
    const process: VacancyForm["process"] = [
      { name: "  ", format: "written" },
      { name: "", format: "written", minutes: 30 },
    ];
    expect(clean({ process }).process).toEqual([{ name: "", format: "written", minutes: 30 }]);
  });

  it("keeps a half-filled form scoreable, so the score works from the first keystroke", () => {
    expect(clarityScore(cleanVacancy(emptyForm("v-2"))).score).toBe(30);
  });

  it("turns a saved vacancy into a form and back without changing it", () => {
    expect(cleanVacancy(formFromVacancy(DEMO_VACANCY))).toEqual(DEMO_VACANCY);
    expect(cleanVacancy(formFromVacancy({ ...DEMO_VACANCY, salary: undefined })).salary).toBeUndefined();
  });
});

describe("formFromDraft", () => {
  const draft = { ...DEMO_VACANCY, company: undefined };

  it("makes the AI's draft an unsaved draft of this vacancy, whatever came back", () => {
    const made = formFromDraft(draft, "v-9");
    expect(made.id).toBe("v-9");
    expect(made.status).toBe("draft");
    expect(made.title).toBe(DEMO_VACANCY.title);
  });

  it("leaves the company blank when the posting doesn't name one", () => {
    expect(formFromDraft(draft, "v-9").company).toBe("");
    expect(formFromDraft({ ...draft, company: "Acme" }, "v-9").company).toBe("Acme");
  });

  it("starts with an empty salary when the posting gives none", () => {
    expect(cleanVacancy(formFromDraft({ ...draft, salary: undefined }, "v-9")).salary).toBeUndefined();
  });
});

describe("saveProblems and publishProblems", () => {
  it("needs a title and a company even for a draft, because a vacancy without them can't be stored", () => {
    expect(saveProblems(clean({ title: " ", company: "" }))).toEqual(["Add the job title.", "Add the company name."]);
  });

  it("explains each wrong value in plain words", () => {
    expect(saveProblems(clean({ salary: { min: 20000, max: 10000, currency: "MXN", period: "month" } }))[0]).toContain("salary");
    expect(saveProblems(clean({ process: [{ name: "Interview", format: "video-call", minutes: 2 }] }))[0]).toContain("5 to 480");
    expect(saveProblems(clean({ process: [{ name: "", format: "written", minutes: 30 }] }))[0]).toContain("name");
    expect(saveProblems(clean({ responseDays: 90 }))[0]).toContain("1 to 30");
  });

  it("names each problem once", () => {
    const process: VacancyForm["process"] = [
      { name: "", format: "written", minutes: 30 },
      { name: "", format: "written", minutes: 30 },
    ];
    expect(saveProblems(clean({ process }))).toHaveLength(1);
  });

  it("lets a draft wait for its hiring steps, but not a published vacancy", () => {
    expect(saveProblems(clean())).toEqual([]);
    expect(publishProblems(clean())).toEqual(["Add at least one hiring step."]);
    expect(publishProblems(clean({ process: PROCESS_TEMPLATE }))).toEqual([]);
  });

  it("publishes a low score: clarity guides the employer and never blocks them", () => {
    const v = clean({ process: PROCESS_TEMPLATE });
    expect(clarityScore(v).score).toBeLessThan(80);
    expect(publishProblems(v)).toEqual([]);
  });
});

describe("PROCESS_TEMPLATE", () => {
  it("leaves every duration to the employer, because a duration is a fact", () => {
    expect(PROCESS_TEMPLATE.every((s) => s.minutes === undefined)).toBe(true);
  });
});

describe("hasBlank", () => {
  it("finds a [bracket] the AI left for the employer", () => {
    expect(hasBlank("[number] orders a day")).toBe(true);
    expect(hasBlank("Answer [how many] emails by [time]")).toBe(true);
    expect(hasBlank("About 20 orders a day")).toBe(false);
  });
});

describe("markPhrases", () => {
  const marked = (text: string) => markPhrases(text).filter((p) => p.marked).map((p) => p.text);

  it("marks every vague phrase and keeps the text whole", () => {
    const text = "We are a fast-paced team.\nYou are a team player in a fast paced place.";
    expect(marked(text)).toEqual(["fast-paced", "team player", "fast paced"]);
    expect(markPhrases(text).map((p) => p.text).join("")).toBe(text);
  });

  it("merges phrases that overlap instead of repeating words", () => {
    for (const [text, phrase] of [
      ["A dynamic fast-paced team.", "dynamic fast-paced team"], // one inside the other
      ["A dynamic team player.", "dynamic team player"], // sharing a word
    ]) {
      expect(markPhrases(text).map((p) => p.text).join("")).toBe(text);
      expect(marked(text)).toEqual([phrase]);
    }
  });

  it("leaves clear text unmarked", () => {
    expect(markPhrases("Answer 20 emails a day")).toEqual([{ text: "Answer 20 emails a day", marked: false }]);
    expect(markPhrases("")).toEqual([]);
  });
});

describe("toggleFactor", () => {
  it("keeps the vocabulary's order", () => {
    expect(toggleFactor(["steady_pace"], "quiet_space", true)).toEqual(["quiet_space", "steady_pace"]);
  });

  it("treats a first tick as the start of a description", () => {
    expect(toggleFactor(undefined, "quiet_space", true)).toEqual(["quiet_space"]);
  });

  it("goes back to not described when the last box is unticked: saying a job offers none is a separate choice", () => {
    expect(toggleFactor(["quiet_space"], "quiet_space", false)).toBeUndefined();
  });
});
