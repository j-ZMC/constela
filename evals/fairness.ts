// The ranking's promises, checked at scale on synthetic people. Pure, so the checks have tests that show they can fail.
// Run with npm run eval:fairness, which writes evals/FAIRNESS.md.
import { DEMO_VACANCY, ENVIRONMENT_FACTORS, EQUIVALENT_SKILLS, MODALITIES, SKILLS, SKILL_IDS, type SkillId, type Vacancy } from "@/lib/vacancy";
import { explainPlace, rankCandidates, type PlaceExplanation, type ProfileSkill, type RankedCandidate, type WorkProfile } from "@/lib/work-profile";

export type Rank = (v: Vacancy, profiles: WorkProfile[]) => RankedCandidate[];
export type Explain = (v: Vacancy, profiles: WorkProfile[], id: string) => PlaceExplanation | null;
export type World = { vacancies: Vacancy[]; pools: WorkProfile[][] };
export type Options = { vacancies: number; people: number; verified: (sharesNeeds: boolean) => number };

const HEADLINES = ["Data analyst", "QA tester", "Bookkeeper", "Graphic designer", "Inventory clerk", "Translator"];
const others = (skill: SkillId) => EQUIVALENT_SKILLS.find((g) => g.includes(skill))?.filter((s) => s !== skill) ?? [];

function tools(random: () => number) {
  const int = (n: number) => Math.floor(random() * n);
  const pick = <T>(list: readonly T[]) => list[int(list.length)];
  const sample = <T>(list: readonly T[], k: number) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, k);
  };
  return { int, pick, sample, chance: (p: number) => random() < p };
}

// Half the people share a need, from 1 to 4 of them, so both groups are large. Skills are drawn the same way for everyone;
// only `verified` can treat the groups differently, to see what an unequal input does to the top places.
export function makeWorld(random: () => number, { vacancies, people, verified }: Options): World {
  const { int, pick, sample, chance } = tools(random);
  const world: World = { vacancies: [], pools: [] };
  for (let v = 0; v < vacancies; v++) {
    const required = sample(SKILL_IDS, 1 + int(4));
    const vacancy: Vacancy = {
      ...DEMO_VACANCY,
      id: `v-${v}`,
      essential: [...required.map((skill) => ({ text: `Use ${SKILLS[skill]} at work`, skill })), ...(chance(0.5) ? [{ text: "Explain your work to the team" }] : [])],
      environment: sample(ENVIRONMENT_FACTORS, int(6)),
      modality: pick(MODALITIES),
    };
    const pool: WorkProfile[] = [];
    for (let i = 0; i < people; i++) {
      const shares = chance(0.5);
      const needs = shares ? sample(ENVIRONMENT_FACTORS, 1 + int(4)) : [];
      const held = new Set<SkillId>();
      for (const skill of required) {
        const roll = random();
        if (roll < 0.5) held.add(skill);
        else if (roll < 0.65 && others(skill).length > 0) held.add(pick(others(skill)));
      }
      for (const skill of sample(SKILL_IDS, int(4))) held.add(skill);
      const skills: ProfileSkill[] = [...held].map((skill) =>
        chance(verified(shares)) ? { skill, evidence: "verified", source: "Constela skill check (synthetic)" } : { skill, evidence: "declared" },
      );
      pool.push({ id: `p-${v}-${String(i).padStart(2, "0")}`, identity: { name: `Person ${v}-${i}` }, headline: pick(HEADLINES), skills, needs, modalities: sample(MODALITIES, int(4)) });
    }
    world.vacancies.push(vacancy);
    world.pools.push(pool);
  }
  return world;
}

export type PromiseId = "needs" | "identity" | "order" | "more-skill" | "other-skills" | "explained" | "nothing-hidden";
export type Broken = { promise: PromiseId; vacancy: string; person: string; detail: string };
export type Audit = { checked: Record<PromiseId, number>; broken: Broken[]; tiesAtCut: number };

const swap = (pool: WorkProfile[], changed: WorkProfile) => pool.map((p) => (p.id === changed.id ? changed : p));
const withSkill = (p: WorkProfile, skill: SkillId, evidence: ProfileSkill["evidence"]): WorkProfile => ({ ...p, skills: [...p.skills.filter((s) => s.skill !== skill), { skill, evidence }] });

export function audit(world: World, random: () => number, rank: Rank = rankCandidates, explain: Explain = explainPlace, top = 5): Audit {
  const { sample, int, chance } = tools(random);
  const checked = { needs: 0, identity: 0, order: 0, "more-skill": 0, "other-skills": 0, explained: 0, "nothing-hidden": 0 } satisfies Record<PromiseId, number>;
  const broken: Broken[] = [];
  let tiesAtCut = 0;

  world.vacancies.forEach((v, index) => {
    const pool = world.pools[index];
    const ranked = rank(v, pool);
    const score = new Map(ranked.map((r) => [r.id, r.score]));
    const place = new Map(ranked.map((r, i) => [r.id, i + 1]));
    const at = (changed: WorkProfile) => {
      const again = rank(v, swap(pool, changed));
      const i = again.findIndex((r) => r.id === changed.id);
      return { score: again[i].score, place: i + 1 };
    };
    const breaks = (promise: PromiseId, person: string, detail: string) => broken.push({ promise, vacancy: v.id, person, detail });
    if (ranked.length > top && ranked[top - 1].score === ranked[top].score && ranked[top].score > 0) tiesAtCut++;

    // The same people in any order: the same order, the same scores.
    const expected = JSON.stringify(ranked.map((r) => [r.id, r.score]));
    for (let k = 0; k < 3; k++) {
      checked.order++;
      const shuffled = JSON.stringify(rank(v, sample(pool, pool.length)).map((r) => [r.id, r.score]));
      if (shuffled !== expected) breaks("order", "-", "another input order gave another ranking");
    }

    const required = [...new Set(v.essential.flatMap((r) => (r.skill ? [r.skill] : [])))];
    const relevant = [...new Set(required.flatMap((s) => [s, ...others(s)]))];
    const unrelated = SKILL_IDS.filter((s) => !relevant.includes(s));

    for (const person of pool) {
      const before = { score: score.get(person.id)!, place: place.get(person.id)! };
      const same = (promise: PromiseId, changed: WorkProfile, what: string) => {
        checked[promise]++;
        const after = at(changed);
        if (after.score !== before.score || after.place !== before.place) breaks(promise, person.id, `${what}: ${before.score} → ${after.score}, place ${before.place} → ${after.place}`);
      };

      // Needs and work modes: none, all of them, and a random set.
      same("needs", { ...person, needs: [], modalities: [] }, "no needs");
      same("needs", { ...person, needs: [...ENVIRONMENT_FACTORS], modalities: [...MODALITIES] }, "every need");
      same("needs", { ...person, needs: sample(ENVIRONMENT_FACTORS, 1 + int(6)), modalities: sample(MODALITIES, int(4)) }, "other needs");
      // Who they are and who checked their skills.
      same("identity", { ...person, identity: { name: "Someone Else" }, headline: "Something else", skills: person.skills.map(({ skill, evidence }) => ({ skill, evidence })) }, "another name, headline and source");
      // A skill the job doesn't ask for.
      const extra = unrelated[int(unrelated.length)];
      if (extra && !person.skills.some((s) => s.skill === extra)) same("other-skills", withSkill(person, extra, chance(0.5) ? "verified" : "declared"), `adding ${extra}`);

      // More of a skill the job asks for never lowers a score or a place, and the best change shown is never beaten.
      const shown = explain(v, pool, person.id);
      for (const skill of relevant) {
        const has = person.skills.find((s) => s.skill === skill)?.evidence;
        for (const evidence of has === "verified" ? [] : has === "declared" ? (["verified"] as const) : (["declared", "verified"] as const)) {
          checked["more-skill"]++;
          const after = at(withSkill(person, skill, evidence));
          if (after.score < before.score || after.place > before.place) breaks("more-skill", person.id, `${evidence} ${skill}: ${before.score} → ${after.score}, place ${before.place} → ${after.place}`);
          if (after.place < before.place) {
            checked["nothing-hidden"]++;
            if (!shown?.changes.some((c) => c.place <= after.place)) breaks("nothing-hidden", person.id, `${evidence} ${skill} would reach place ${after.place}, and nothing shown does`);
          }
        }
      }

      // What "What would change the order" shows is what the ranking really does.
      checked.explained++;
      if (!shown || shown.place !== before.place || !shown.sameWithoutNeeds) breaks("explained", person.id, `shows place ${shown?.place}, really ${before.place}`);
      for (const c of shown?.changes ?? []) {
        checked.explained++;
        const after = at(withSkill(person, c.skill, "verified"));
        if (after.place !== c.place || c.place >= before.place) breaks("explained", person.id, `${c.change} ${c.skill}: shows place ${c.place}, really ${after.place}`);
      }
    }
  });
  return { checked, broken, tiesAtCut };
}

// Who reaches the top places: a person counts when they are in the top `top` of their pool with a score above 0.
export type Rates = Record<string, { selected: number; total: number }>;

export function selection(world: World, groupOf: (p: WorkProfile) => string, rank: Rank = rankCandidates, top = 5, prepare = (p: WorkProfile) => p): Rates {
  const rates: Rates = {};
  world.vacancies.forEach((v, index) => {
    const pool = world.pools[index];
    const ranked = rank(v, pool.map(prepare));
    const chosen = new Set(ranked.slice(0, top).filter((r) => r.score > 0).map((r) => r.id));
    for (const p of pool) {
      const group = (rates[groupOf(p)] ??= { selected: 0, total: 0 });
      group.total++;
      if (chosen.has(p.id)) group.selected++;
    }
  });
  return rates;
}

// The lowest group rate over the highest. Under 0.8 fails the four-fifths rule used in US hiring.
export function impactRatio(rates: Rates): number {
  const values = Object.values(rates).map((r) => r.selected / r.total);
  return Math.min(...values) / Math.max(...values);
}

export const sharedNeeds = (p: WorkProfile) => (p.needs.length === 0 ? "Shares no need" : p.needs.length <= 2 ? "Shares 1 or 2 needs" : "Shares 3 or more needs");
export const sharesAny = (p: WorkProfile) => (p.needs.length === 0 ? "Shares no need" : "Shares a need");
// What the ranking would do if a skill they say they have counted the same as a checked one.
export const allChecked = (p: WorkProfile): WorkProfile => ({ ...p, skills: p.skills.map((s) => ({ ...s, evidence: "verified" })) });
