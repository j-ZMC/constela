// Checks ranking v1's promises on thousands of synthetic people and writes evals/FAIRNESS.md. Offline, in seconds.
// Run: npm run eval:fairness
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allChecked, audit, impactRatio, makeWorld, selection, sharedNeeds, sharesAny, type PromiseId, type Rates } from "./fairness";
import { seeded, share } from "./stats";

const SEED = 20261104;
const VACANCIES = 300;
const PEOPLE = 30;
const TOP = 5;
const BASE = 0.65; // how often a skill is checked by Constela in the synthetic world
const GAPS = [0, 0.15, 0.3, 0.45];

const PROMISES: Record<PromiseId, string> = {
  needs: "Sharing, hiding, adding or removing needs and work modes changes no score and no place",
  identity: "A name, a headline or who checked a skill changes no score and no place",
  "other-skills": "A skill the job doesn't ask for changes no score and no place",
  order: "The same people in any input order get the same order and scores",
  "more-skill": "More of a skill the job asks for never lowers a score or a place",
  explained: '"What would change the order" shows the place the ranking really gives',
  "nothing-hidden": "No single skill change moves anyone higher than the best change shown",
};

const ratio = (x: number) => x.toFixed(2);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const GROUP_ORDER = ["Shares no need", "Shares 1 or 2 needs", "Shares 3 or more needs", "Shares a need"];
const table = (rates: Rates) =>
  Object.entries(rates)
    .sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
    .map(([group, r]) => `| ${group} | ${r.total.toLocaleString("en-US")} | ${share(r.selected, r.total)} |`)
    .join("\n");

describe("ranking fairness", () => {
  it("keeps every promise on thousands of synthetic people", () => {
    const started = Date.now();
    const world = makeWorld(seeded(SEED), { vacancies: VACANCIES, people: PEOPLE, verified: () => BASE });
    const result = audit(world, seeded(SEED + 1), undefined, undefined, TOP);
    const total = Object.values(result.checked).reduce((sum, n) => sum + n, 0);
    const byCount = selection(world, sharedNeeds, undefined, TOP);
    const byAny = selection(world, sharesAny, undefined, TOP);

    // The same generator, with skills checked less often for people who share a need.
    const scenarios = GAPS.map((gap) => {
      const biased = makeWorld(seeded(SEED), { vacancies: VACANCIES, people: PEOPLE, verified: (shares) => (shares ? BASE - gap : BASE) });
      return { gap, now: impactRatio(selection(biased, sharesAny, undefined, TOP)), sameWeight: impactRatio(selection(biased, sharesAny, undefined, TOP, allChecked)) };
    });
    const firstUnder = scenarios.find((s) => s.now < 0.8);
    const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));

    const brokenBy = (id: PromiseId) => result.broken.filter((b) => b.promise === id).length;
    const report = `# Ranking fairness audit

Ranking v1 (\`src/lib/work-profile.ts\`), ${new Date().toISOString().slice(0, 10)}. ${VACANCIES} synthetic job posts, each with its own pool of ${PEOPLE} synthetic people: ${(VACANCIES * PEOPLE).toLocaleString("en-US")} people, ${total.toLocaleString("en-US")} checks, ${seconds} s.
Seeded, so every run gives the same numbers. Run it again with \`npm run eval:fairness\`, offline.

The CV-pair test in \`npm test\` checks one pair of people. This checks the same promise, and six more, on every person here, by running the real ranking again with one thing changed.

## The ranking's promises

| Promise | Checks | Broken |
| --- | --- | --- |
${(Object.keys(PROMISES) as PromiseId[]).map((id) => `| ${PROMISES[id]} | ${result.checked[id].toLocaleString("en-US")} | **${brokenBy(id)}** |`).join("\n")}

The audit fails if any is above zero. Its own tests (\`evals/fairness.test.ts\`) give it a ranking broken on purpose for each promise, and it catches every one.

## Who reaches the top ${TOP}

A person counts when they are in the top ${TOP} of their pool with a score above 0. Skills here are drawn the same way for everyone, so this shows the method, not the world.

| Group | People | In the top ${TOP} |
| --- | --- | --- |
${table(byCount)}

Impact ratio, the lowest rate over the highest: ${ratio(impactRatio(byCount))} (sharing a need or not: ${ratio(impactRatio(byAny))}). The four-fifths rule used in US hiring asks for 0.8 or more.

## If the inputs carry a bias

The ranking never reads needs. It does read whether Constela checked a skill: a checked skill counts 1, a stated one 0.6. So if people who share a need got their skills checked less often, fewer of them would reach the top, with the ranking working exactly as designed. Same people and same skills below; only how often a skill was checked changes.

| Skills checked: shares a need / shares none | Impact ratio now | If a stated skill counted the same as a checked one |
| --- | --- | --- |
${scenarios.map((s) => `| ${pct(BASE - s.gap)} / ${pct(BASE)} | ${ratio(s.now)}${s.now < 0.8 ? " (under 0.8)" : ""} | ${ratio(s.sameWeight)} |`).join("\n")}

${firstUnder ? `At a gap of ${Math.round(firstUnder.gap * 100)} points the ratio falls under 0.8.` : "No gap tried here takes the ratio under 0.8."} The checked-skill weight passes an unequal input straight through, while counting every skill the same doesn't. That is the trade: the weight rewards proof, so proof has to be equally easy to get. With real people, measure who gets their skills checked before trusting the 0.6.

## Ties at the cut

Pools where the ${TOP}th and ${TOP + 1}th places had the same score: ${share(result.tiesAtCut, VACANCIES)}. In those, the order by id decided who made the top ${TOP}. The order is fixed, so it is fair between runs, but it means nothing about the people. People with the same score should be shown as tied.

## Limits

- Synthetic people and job posts. This shows what the code does, every time, not what happens to real people.
- Groups come from the number of needs shared, the only group information a profile has. A profile has no diagnosis, age, gender or race, so none of those can be measured here, or leak into the ranking.
- The four-fifths rule (US Uniform Guidelines on Employee Selection Procedures, 1978) is a rule of thumb that flags a gap. It doesn't prove fairness, or its absence.
`;
    mkdirSync("evals/results", { recursive: true });
    writeFileSync("evals/FAIRNESS.md", report);
    writeFileSync(
      "evals/results/fairness.json",
      `${JSON.stringify({ seed: SEED, vacancies: VACANCIES, people: PEOPLE, top: TOP, checked: result.checked, broken: result.broken.slice(0, 50), tiesAtCut: result.tiesAtCut, byCount, byAny, scenarios }, null, 2)}\n`,
    );
    console.log(report);

    expect(total).toBeGreaterThan(100_000);
    expect(result.broken).toEqual([]);
  });
});
