import { describe, expect, it } from "vitest";
import { barrierCatalog } from "@/lib/barrier-preferences";
import { DEMO_VACANCY, SKILLS, SKILL_IDS, type EnvironmentFactor, type SkillId, type Vacancy } from "@/lib/vacancy";
import {
  DEMO_PROFILES,
  adjustmentNotes,
  anonymize,
  compatibility,
  fitSummary,
  identityFor,
  latestPermission,
  matchReason,
  needsFromBarriers,
  rankCandidates,
  skillsLine,
  talentRows,
  workProfileSchema,
  type Permission,
  type WorkProfile,
} from "@/lib/work-profile";

const person = (id: string, skills: WorkProfile["skills"], extra: Partial<WorkProfile> = {}): WorkProfile => ({
  id,
  headline: "Data analyst",
  skills,
  needs: [],
  modalities: [],
  identity: { name: `Person ${id}` },
  ...extra,
});

const asking = (skills: SkillId[]): Vacancy => ({ ...DEMO_VACANCY, essential: skills.map((skill) => ({ text: SKILLS[skill], skill })) });

describe("work profile schema", () => {
  it("accepts every demo profile", () => {
    expect(DEMO_PROFILES.every((p) => workProfileSchema.safeParse(p).success)).toBe(true);
  });

  it("has no place for a diagnosis, age or photo", () => {
    const [p] = DEMO_PROFILES;
    expect(workProfileSchema.safeParse({ ...p, diagnosis: "ADHD" }).success).toBe(false);
    expect(workProfileSchema.safeParse({ ...p, age: 29 }).success).toBe(false);
    expect(workProfileSchema.safeParse({ ...p, identity: { ...p.identity, photo: "me.png" } }).success).toBe(false);
  });
});

describe("anonymous view and permission", () => {
  const [p] = DEMO_PROFILES;
  const at = (minute: number) => `2026-10-30T10:0${minute}:00.000Z`;
  const permit = (status: Permission["status"], minute: number, vacancyId = DEMO_VACANCY.id): Permission => ({
    candidateId: p.id,
    vacancyId,
    status,
    at: at(minute),
  });

  it("shows skills and shared needs but never the name", () => {
    const view = anonymize(p);
    expect(view.alias).toBe("Candidate 1042");
    expect(view.skills).toEqual(p.skills);
    expect(JSON.stringify(view)).not.toContain(p.identity.name);
  });

  it("reveals the identity only after the candidate accepts, for that vacancy only", () => {
    expect(identityFor(p, [], DEMO_VACANCY.id)).toBeNull();
    expect(identityFor(p, [permit("invited", 1)], DEMO_VACANCY.id)).toBeNull();
    expect(identityFor(p, [permit("invited", 1), permit("accepted", 2)], DEMO_VACANCY.id)).toEqual(p.identity);
    expect(identityFor(p, [permit("accepted", 2, "other-vacancy")], DEMO_VACANCY.id)).toBeNull();
  });

  it("hides the identity again when the candidate later says no", () => {
    expect(identityFor(p, [permit("declined", 3), permit("accepted", 2)], DEMO_VACANCY.id)).toBeNull();
  });

  it("finds the latest answer for that person and that vacancy", () => {
    expect(latestPermission([], p.id, DEMO_VACANCY.id)).toBeUndefined();
    expect(latestPermission([permit("accepted", 2), permit("invited", 1)], p.id, DEMO_VACANCY.id)?.status).toBe("accepted");
    expect(latestPermission([permit("accepted", 2, "other-vacancy")], p.id, DEMO_VACANCY.id)).toBeUndefined();
    expect(latestPermission([permit("accepted", 2)], "someone-else", DEMO_VACANCY.id)).toBeUndefined();
  });

  it("lets the answer given last win when two share a time", () => {
    expect(latestPermission([permit("accepted", 2), permit("declined", 2)], p.id, DEMO_VACANCY.id)?.status).toBe("declined");
  });
});

describe("needsFromBarriers", () => {
  const allIds = barrierCatalog.categories.flatMap((c) => c.subtypes.map((s) => `${c.id}:${s.id}`));

  it("maps every barrier in the survey to at least one environment factor", () => {
    const unmapped = allIds.filter((id) => needsFromBarriers([id]).length === 0);
    expect(unmapped).toEqual([]);
  });

  it("never lets a diagnosis category through", () => {
    const out = needsFromBarriers(allIds).join(" ");
    expect(out).not.toContain(":");
    for (const c of barrierCatalog.categories) expect(out).not.toContain(c.id);
  });

  it("drops unknown ids and repeats", () => {
    expect(needsFromBarriers(["adhd:distraction_and_interruptions", "sensory_processing_differences:sound", "x:unknown"])).toEqual([
      "quiet_space",
      "focus_time",
    ]);
  });
});

describe("compatibility", () => {
  it("splits shared needs into met and gaps when the vacancy describes its environment", () => {
    const fit = compatibility(DEMO_VACANCY, { needs: ["quiet_space", "flexible_breaks"], modalities: ["remote"] });
    expect(fit).toEqual({ met: ["quiet_space"], gaps: ["flexible_breaks"], unknown: [], modality: "gap" });
  });

  it("marks needs unknown when the vacancy has not described its environment", () => {
    const fit = compatibility({ ...DEMO_VACANCY, environment: undefined, modality: undefined }, { needs: ["quiet_space"], modalities: ["hybrid"] });
    expect(fit).toEqual({ met: [], gaps: [], unknown: ["quiet_space"], modality: "unknown" });
  });

  it("treats no modality preference as any", () => {
    expect(compatibility(DEMO_VACANCY, { needs: [], modalities: [] }).modality).toBe("any");
    expect(compatibility(DEMO_VACANCY, { needs: [], modalities: ["hybrid"] }).modality).toBe("met");
  });
});

describe("fitSummary", () => {
  const summary = (needs: EnvironmentFactor[], v: Vacancy = DEMO_VACANCY) => fitSummary(compatibility(v, { needs, modalities: [] }));

  it("says how many of the things the candidate asked for the job offers", () => {
    expect(summary(["quiet_space", "focus_time", "steady_pace", "soft_lighting"])).toBe("This job offers 3 of the 4 things you asked for.");
    expect(summary(["soft_lighting"])).toBe("This job offers 0 of the 1 thing you asked for.");
  });

  it("is plain when the job offers everything", () => {
    expect(summary(["quiet_space", "focus_time"])).toBe("This job offers everything you asked for.");
  });

  it("doesn't count a job against the candidate when its environment isn't described", () => {
    expect(summary(["quiet_space"], { ...DEMO_VACANCY, environment: undefined })).toBe("This employer has not described the work environment yet.");
  });

  it("says nothing when the candidate asked for nothing", () => {
    expect(summary([])).toBeNull();
  });
});

describe("rankCandidates", () => {
  it("weighs verified 1, declared 0.6, an equivalent tool half of that, and missing 0", () => {
    const ranked = rankCandidates(asking(["excel"]), [
      person("a", [{ skill: "excel", evidence: "verified" }]),
      person("b", [{ skill: "excel", evidence: "declared" }]),
      person("c", [{ skill: "google_sheets", evidence: "verified" }]),
      person("d", [{ skill: "google_sheets", evidence: "declared" }]),
      person("e", [{ skill: "sql", evidence: "verified" }]),
    ]);
    expect(ranked.map((r) => [r.id, r.score])).toEqual([
      ["a", 100],
      ["b", 60],
      ["c", 50],
      ["d", 30],
      ["e", 0],
    ]);
    expect(ranked[2].matches[0]).toMatchObject({ skill: "excel", via: "google_sheets", evidence: "verified" });
  });

  it("averages over skill-tagged essential requirements and ignores untagged ones", () => {
    const v: Vacancy = { ...asking(["sql", "excel"]), essential: [...asking(["sql", "excel"]).essential, { text: "Driving licence" }] };
    const [r] = rankCandidates(v, [person("a", [{ skill: "sql", evidence: "verified" }])]);
    expect(r.score).toBe(50);
    expect(r.matches.map((m) => m.requirement)).toEqual(["SQL", "Excel"]);
  });

  it("scores 0 when no essential requirement has a skill, and keeps a stable order on ties", () => {
    const v: Vacancy = { ...DEMO_VACANCY, essential: [{ text: "Driving licence" }] };
    expect(rankCandidates(v, [person("b", []), person("a", [])]).map((r) => [r.id, r.score])).toEqual([
      ["a", 0],
      ["b", 0],
    ]);
  });

  it("ranks the demo pool for the demo vacancy with reasons", () => {
    const [top] = rankCandidates(DEMO_VACANCY, DEMO_PROFILES);
    expect(top.id).toBe("c-2187"); // declared SQL, verified Power BI, Google Sheets for Excel
    expect(top.score).toBeGreaterThan(0);
    expect(top.matches.every((m) => m.requirement.length > 0)).toBe(true);
  });
});

describe("matchReason", () => {
  const reason = (skills: WorkProfile["skills"]) => matchReason(rankCandidates(asking(["excel"]), [person("a", skills)])[0].matches[0]);

  it("says how each requirement was met", () => {
    expect(reason([{ skill: "excel", evidence: "verified" }])).toBe("Excel: checked by Constela");
    expect(reason([{ skill: "excel", evidence: "declared" }])).toBe("Excel: they say they have it");
    expect(reason([{ skill: "google_sheets", evidence: "verified" }])).toBe("Excel: they use Google Sheets, a similar tool, checked by Constela");
    expect(reason([{ skill: "google_sheets", evidence: "declared" }])).toBe("Excel: they use Google Sheets, a similar tool, they say they have it");
    expect(reason([])).toBe("Excel: not on this profile");
  });
});

describe("skillsLine", () => {
  it("says the score in words and whole numbers", () => {
    expect(skillsLine({ has: 2, similar: 1, total: 3 })).toBe("2 of 3 skills, 1 similar");
    expect(skillsLine({ has: 1, similar: 0, total: 3 })).toBe("1 of 3 skills");
    expect(skillsLine({ has: 1, similar: 0, total: 1 })).toBe("1 of 1 skill");
  });

  it("doesn't say 0 of 3 when a similar tool is all there is", () => {
    expect(skillsLine({ has: 0, similar: 1, total: 3 })).toBe("1 similar skill");
    expect(skillsLine({ has: 0, similar: 2, total: 3 })).toBe("2 similar skills");
  });
});

describe("adjustmentNotes", () => {
  const notes = (v: Vacancy, p: Pick<WorkProfile, "needs" | "modalities">) => adjustmentNotes(compatibility(v, p), p.modalities, v);

  it("shows a gap as something the employer could offer", () => {
    expect(notes(DEMO_VACANCY, { needs: ["quiet_space", "flexible_breaks"], modalities: [] })).toEqual([
      "You already offer: Quiet place to work.",
      "You could offer: Freedom to take breaks and move around.",
    ]);
  });

  it("asks for the environment when the vacancy hasn't described it", () => {
    expect(notes({ ...DEMO_VACANCY, environment: undefined }, { needs: ["quiet_space"], modalities: [] })).toEqual([
      "Would help this person: Quiet place to work. Describe your work environment to see what you already offer.",
    ]);
  });

  it("mentions work mode only when there is something to talk about", () => {
    expect(notes(DEMO_VACANCY, { needs: [], modalities: ["remote", "on-site"] })).toEqual(["They prefer remote or on-site work. This job is hybrid."]);
    expect(notes({ ...DEMO_VACANCY, modality: undefined }, { needs: [], modalities: ["remote"] })).toEqual(["They prefer remote work. Add the work mode to see if it fits."]);
    expect(notes(DEMO_VACANCY, { needs: [], modalities: ["hybrid"] })).toEqual([]);
  });

  it("says nothing when the person shared nothing", () => {
    expect(notes(DEMO_VACANCY, { needs: [], modalities: [] })).toEqual([]);
  });
});

describe("talentRows", () => {
  const v = asking(["sql", "excel"]);
  const strong = person("c-0001", [{ skill: "sql", evidence: "verified" }, { skill: "excel", evidence: "verified" }], { needs: ["soft_lighting"], modalities: ["remote"] });
  const partial = person("c-0002", [{ skill: "sql", evidence: "declared" }]);
  const none = person("c-0003", [{ skill: "figma", evidence: "verified" }]);
  const pool = [none, partial, strong];
  const permit = (candidateId: string, status: Permission["status"], minute = 1, vacancyId = v.id): Permission => ({
    candidateId,
    vacancyId,
    status,
    at: `2026-10-30T10:0${minute}:00.000Z`,
  });

  it("keeps the order of the ranking, with the score and its reasons", () => {
    const rows = talentRows(v, pool, []);
    expect(rows.map((r) => [r.profile.id, r.score])).toEqual([
      ["c-0001", 100],
      ["c-0002", 30],
    ]);
    expect(rows[1].reasons).toEqual(["SQL: they say they have it", "Excel: not on this profile"]);
  });

  it("counts skills and similar tools apart, as the demo pool shows", () => {
    const counts = talentRows(DEMO_VACANCY, DEMO_PROFILES, []).map((r) => [r.profile.id, r.has, r.similar, r.total]);
    expect(counts).toEqual([
      ["c-2187", 2, 1, 3],
      ["c-1042", 2, 1, 3],
      ["c-9417", 1, 0, 3],
      ["c-3772", 1, 0, 3],
      ["c-2659", 0, 1, 3],
    ]);
  });

  it("leaves out people with none of these skills, unless they were already invited", () => {
    expect(talentRows(v, pool, []).map((r) => r.profile.id)).not.toContain("c-0003");
    expect(talentRows(v, pool, [permit("c-0003", "invited")]).map((r) => r.profile.id)).toContain("c-0003");
  });

  it("never carries a name, in any field, before the person says yes", () => {
    const rows = talentRows(v, pool, [permit("c-0001", "invited"), permit("c-0002", "declined")]);
    expect(JSON.stringify(rows)).not.toContain("Person c-");
    expect(rows.map((r) => r.status)).toEqual(["invited", "declined"]);
  });

  it("gives the name after a yes, for that vacancy only", () => {
    const [row] = talentRows(v, pool, [permit("c-0001", "invited", 1), permit("c-0001", "accepted", 2)]);
    expect(row.name).toBe("Person c-0001");
    expect(row.status).toBe("accepted");
    expect(talentRows(v, pool, [permit("c-0001", "accepted", 2, "other-vacancy")])[0].name).toBeNull();
  });

  it("hides the name again after a later no", () => {
    const [row] = talentRows(v, pool, [permit("c-0001", "accepted", 2), permit("c-0001", "declined", 3)]);
    expect(row.name).toBeNull();
    expect(row.status).toBe("declined");
  });

  it("explains fit without changing the order", () => {
    const rows = talentRows(v, pool, []);
    expect(rows[0].notes).toContain("You could offer: Soft or natural light.");
    expect(rows.map((r) => r.profile.id)).toEqual(rankCandidates(v, pool).slice(0, 2).map((r) => r.id));
  });
});

// The CV-pair test from the features document, run on every ranking change. Resume audits found AI screeners ranked a
// CV lower once a disability-related award was added, even though it had one more merit.
describe("CV-pair test", () => {
  const DISABILITY_TEXTS = [
    "Disability Leadership Award",
    "Neurodivergent Employee Network, co-lead",
    "Autistic Self-Advocacy Fellowship",
    "Dyslexia Association volunteer tutor",
    "ADHD peer mentor",
    "Disabled Students Union, treasurer",
    "Accessible Tech Hackathon, winner",
    "Tourette Awareness Day organizer",
    "Disability Inclusion Scholarship",
    "Mental health peer support lead",
  ];
  const SHARED_NEEDS: EnvironmentFactor[] = ["quiet_space", "written_communication", "flexible_breaks", "steady_pace"];

  // Each vacancy asks for two of A's skills plus one A lacks. B is A plus that skill, verified by a disability-related
  // source, plus shared needs. C is A with only the disability-related text and the needs: no extra merit.
  const pairs = DEMO_PROFILES.slice(0, 10).map((a, i) => {
    const lacking = SKILL_IDS.find((s) => rankCandidates(asking([s]), [a])[0].score === 0) as SkillId;
    const vacancy = asking([a.skills[0].skill, a.skills[1].skill, lacking]);
    const b: WorkProfile = {
      ...a,
      id: `${a.id}-b`,
      skills: [...a.skills, { skill: lacking, evidence: "verified", source: DISABILITY_TEXTS[i] }],
      needs: SHARED_NEEDS,
    };
    const c: WorkProfile = {
      ...a,
      id: `${a.id}-c`,
      skills: a.skills.map((s, j) => (j === 0 ? { ...s, source: DISABILITY_TEXTS[i] } : s)),
      needs: SHARED_NEEDS,
      modalities: ["remote"],
    };
    return { vacancy, a, b, c };
  });

  it("uses 10 distinct pairs", () => {
    expect(new Set(pairs.map((p) => p.a.id)).size).toBe(10);
  });

  it("B, with one more verified merit and disability-related text, ranks above A in 10 of 10 pairs", () => {
    const wins = pairs.filter(({ vacancy, a, b }) => {
      const [first, second] = rankCandidates(vacancy, [a, b]);
      return first.id === b.id && first.score > second.score;
    });
    expect(wins).toHaveLength(10);
  });

  it("the same profile with and without disability-related text and shared needs gets the same score", () => {
    const same = pairs.filter(({ vacancy, a, c }) => {
      const scores = Object.fromEntries(rankCandidates(vacancy, [a, c]).map((r) => [r.id, r.score]));
      return scores[a.id] === scores[c.id];
    });
    expect(same).toHaveLength(10);
  });
});
