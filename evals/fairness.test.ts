import { describe, expect, it } from "vitest";
import { vacancySchema } from "@/lib/vacancy";
import { explainPlace, rankCandidates, workProfileSchema, type WorkProfile } from "@/lib/work-profile";
import { allChecked, audit, impactRatio, makeWorld, selection, sharesAny, type Explain, type PromiseId, type Rank } from "./fairness";
import { seeded } from "./stats";

const small = () => makeWorld(seeded(7), { vacancies: 12, people: 12, verified: () => 0.6 });
const brokenBy = (rank: Rank = rankCandidates, explain: Explain = explainPlace) => {
  const counts: Partial<Record<PromiseId, number>> = {};
  for (const b of audit(small(), seeded(8), rank, explain).broken) counts[b.promise] = (counts[b.promise] ?? 0) + 1;
  return counts;
};
// A ranking that takes points away for something it must never read.
const penalize = (lose: (p: WorkProfile) => boolean): Rank => (v, ps) =>
  rankCandidates(v, ps)
    .map((r) => ({ ...r, score: lose(ps.find((p) => p.id === r.id)!) ? r.score - 30 : r.score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

describe("the synthetic world", () => {
  it("is the same for the same seed", () => {
    expect(JSON.stringify(small())).toBe(JSON.stringify(small()));
  });

  it("holds only valid job posts and profiles", () => {
    const { vacancies, pools } = small();
    for (const v of vacancies) expect(vacancySchema.safeParse(v).success).toBe(true);
    for (const p of pools.flat()) expect(workProfileSchema.safeParse(p).success).toBe(true);
  });

  it("splits people about evenly between sharing a need and not", () => {
    const people = small().pools.flat();
    const sharing = people.filter((p) => p.needs.length > 0).length / people.length;
    expect(sharing).toBeGreaterThan(0.35);
    expect(sharing).toBeLessThan(0.65);
  });
});

describe("the audit", () => {
  it("finds nothing broken in ranking v1", () => {
    expect(brokenBy()).toEqual({});
  });

  it("catches a ranking that reads needs", () => {
    expect(brokenBy(penalize((p) => p.needs.length > 2)).needs).toBeGreaterThan(0);
  });

  it("catches a ranking that reads a headline", () => {
    expect(brokenBy(penalize((p) => p.headline === "Translator")).identity).toBeGreaterThan(0);
  });

  it("catches a ranking that breaks ties by the order people arrive in", () => {
    const arrival: Rank = (v, ps) => [...rankCandidates(v, ps)].sort((a, b) => ps.findIndex((p) => p.id === a.id) - ps.findIndex((p) => p.id === b.id)).sort((a, b) => b.score - a.score);
    expect(brokenBy(arrival).order).toBeGreaterThan(0);
  });

  it("catches a ranking where a checked skill counts less than a stated one", () => {
    const backwards: Rank = (v, ps) => rankCandidates(v, ps.map((p) => ({ ...p, skills: p.skills.map((s) => ({ ...s, evidence: s.evidence === "verified" ? "declared" : "verified" })) })));
    expect(brokenBy(backwards)["more-skill"]).toBeGreaterThan(0);
  });

  it("catches a ranking that reads skills the job doesn't ask for", () => {
    expect(brokenBy(penalize((p) => p.skills.length > 4))["other-skills"]).toBeGreaterThan(0);
  });

  it("catches an explanation that promises more than the ranking gives", () => {
    const boastful: Explain = (v, ps, id) => {
      const real = explainPlace(v, ps, id);
      return real && { ...real, changes: real.changes.map((c) => ({ ...c, place: 1 })) };
    };
    expect(brokenBy(rankCandidates, boastful).explained).toBeGreaterThan(0);
  });

  it("catches an explanation that hides a way up", () => {
    const silent: Explain = (v, ps, id) => {
      const real = explainPlace(v, ps, id);
      return real && { ...real, changes: [] };
    };
    expect(brokenBy(rankCandidates, silent)["nothing-hidden"]).toBeGreaterThan(0);
  });
});

describe("who reaches the top places", () => {
  it("counts every person once per job post", () => {
    const rates = selection(small(), sharesAny);
    expect(Object.values(rates).reduce((sum, r) => sum + r.total, 0)).toBe(12 * 12);
    expect(Object.values(rates).reduce((sum, r) => sum + r.selected, 0)).toBeLessThanOrEqual(12 * 5);
  });

  it("gives the lowest rate over the highest", () => {
    expect(impactRatio({ a: { selected: 2, total: 10 }, b: { selected: 4, total: 10 } })).toBeCloseTo(0.5);
    expect(impactRatio({ a: { selected: 3, total: 10 }, b: { selected: 3, total: 10 } })).toBe(1);
  });

  it("can count a stated skill as a checked one", () => {
    const p = small().pools[0][0];
    expect(allChecked(p).skills.every((s) => s.evidence === "verified")).toBe(true);
    expect(allChecked(p).skills.map((s) => s.skill)).toEqual(p.skills.map((s) => s.skill));
  });
});
