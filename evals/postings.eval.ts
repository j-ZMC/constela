// What real job postings tell a candidate before they apply, read with the same phrase detector as the editor.
// Run: npm run eval:postings (a few seconds, no network). Writes evals/POSTINGS.md, evals/results/postings.json and
// src/lib/posting-facts.json, which the Jobs page reads.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECKS, isComplete, isEnglish, plain, postingKey, readPosting, readingGrade, type Check, type Posting } from "./postings";
import { percentile, share, wilson } from "./stats";
import type { PostingFacts } from "@/lib/posting-facts";
import { DEMO_VACANCY, EXCLUSIONARY_PHRASES, findExclusionaryPhrases } from "@/lib/vacancy";

const DATA = "backend/data/raw/jobs/jobs_usa_full_backup_cleaned.json";

// mulberry32: seeded, so the examples in the report are the same on every run.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LABELS: Record<Check, string> = {
  pay: "Says the pay",
  workMode: "Says if it is remote, hybrid or on-site",
  schedule: "Says the working days or hours",
  stepLength: "Says how long a hiring step takes",
  answerTime: "Says when they will answer",
  accommodation: "Mentions adjustments (accommodations), even in a legal sentence",
};

const percent = (k: number, n: number) => `${Math.round((100 * k) / n)}%`;

describe("real job postings", () => {
  it("are read the way Constela reads a job post", () => {
    const raw = JSON.parse(readFileSync(DATA, "utf8")) as Posting[];
    const all: Posting[] = raw.map((p) => ({ ...p, title: p.title ?? "", company: p.company ?? "", modality: p.modality ?? "", description: p.description ?? "", source: p.source || "unknown" }));
    const seen = new Set<string>();
    const unique = all.filter((p) => !seen.has(postingKey(p)) && seen.add(postingKey(p)));
    const english = unique.filter((p) => isEnglish(plain(p.description)));
    const complete = english.filter(isComplete);
    const read = new Map(english.map((p) => [p, readPosting(p)]));
    const of = (p: Posting) => read.get(p)!;

    const count = (list: Posting[], test: (p: Posting) => boolean) => list.filter(test).length;
    const vagueComplete = count(complete, (p) => of(p).vague.length > 0);
    const vagueAll = count(english, (p) => of(p).vague.length > 0);
    const has = (check: Check) => count(complete, (p) => of(p).checks[check]);
    const bothSteps = count(complete, (p) => of(p).checks.stepLength && of(p).checks.answerTime);
    const scores = complete.map((p) => of(p).clarityAtBest);
    const clear = scores.filter((s) => s >= 80).length;
    const grades = complete.flatMap((p) => readingGrade(p.description) ?? []);
    const demoText = [DEMO_VACANCY.title, DEMO_VACANCY.summary, ...DEMO_VACANCY.tasks, ...DEMO_VACANCY.essential.map((r) => r.text)].join(". ") + ".";
    const demoGrade = readingGrade(demoText) ?? 0;

    // Which phrases, on whole postings.
    const phraseCounts = EXCLUSIONARY_PHRASES.map(({ id }) => ({ id, n: count(complete, (p) => of(p).vague.includes(id)) })).sort((a, b) => b.n - a.n);
    const example = new Map<string, string>(EXCLUSIONARY_PHRASES.map(({ id }) => [id, ""]));
    for (const p of complete) for (const m of findExclusionaryPhrases(plain(p.description))) if (!example.get(m.id)) example.set(m.id, m.match);

    // Is the whole-posting sample like the rest? By job board.
    const sources = [...new Set(english.map((p) => p.source))].sort();
    const mix = sources.map((s) => ({ s, all: count(english, (p) => p.source === s), complete: count(complete, (p) => p.source === s) })).sort((a, b) => b.all - a.all);
    const bySource = mix
      .filter((m) => m.complete >= 30)
      .map(({ s }) => {
        const list = complete.filter((p) => p.source === s);
        return { s, n: list.length, vague: count(list, (p) => of(p).vague.length > 0), pay: count(list, (p) => of(p).checks.pay), answer: count(list, (p) => of(p).checks.answerTime), median: percentile(list.map((p) => of(p).clarityAtBest), 50) };
      });

    // Random matches for every check, so anyone can see what it counts.
    const random = seeded(20261104);
    const pick = <T,>(list: T[], k: number) => [...list].sort(() => random() - 0.5).slice(0, k + 2);
    const around = (text: string, pattern: RegExp) => {
      const m = pattern.exec(text);
      if (!m) return "";
      return `…${text.slice(Math.max(0, m.index - 70), m.index + m[0].length + 70).trim()}…`;
    };
    const samples = (Object.keys(CHECKS) as Check[]).map((check) => ({
      check,
      shown: pick(
        complete.filter((p) => CHECKS[check].test(plain(p.description))),
        3,
      )
        .map((p) => around(plain(p.description), CHECKS[check]))
        .filter((text, i, list) => list.indexOf(text) === i),
    }));
    const vagueSamples = pick(
      complete.filter((p) => of(p).vague.length > 0),
      4,
    ).map((p) => {
      const m = findExclusionaryPhrases(plain(p.description))[0];
      const text = plain(p.description);
      const at = text.indexOf(m.match);
      return `…${text.slice(Math.max(0, at - 60), at + m.match.length + 60).trim()}…`;
    });

    const n = complete.length;
    const md = `# What real job posts tell a candidate

${all.length.toLocaleString("en-US")} job posts collected in 2026 from ${sources.length} job boards in the United States (\`${DATA}\`), read with the same vague-phrase detector the Constela editor uses, and with plain checks for what a candidate needs to know before applying. Run it again with \`npm run eval:postings\`: it takes seconds and needs no network. Every rate has a 95% Wilson interval.

## The posts

| Step | Posts |
| --- | --- |
| Collected | ${all.length.toLocaleString("en-US")} |
| The same post from two boards, kept once | ${unique.length.toLocaleString("en-US")} |
| In English, which the detector reads | ${english.length.toLocaleString("en-US")} |
| **Whole**: the collector cut ${percent(english.length - n, english.length)} of descriptions at about 4,000 characters | **${n.toLocaleString("en-US")}** |

Pay ranges, hiring steps and adjustments usually come at the end of a post, so everything that needs the whole text is measured on the ${n.toLocaleString("en-US")} whole posts. Vague phrases are also counted on all ${english.length.toLocaleString("en-US")}, where a cut text can only hide more of them.

## What they leave out

| Measure | Whole posts |
| --- | --- |
| Use at least one vague phrase | **${share(vagueComplete, n)}** |
| ...counted on every post, cut or whole (a floor) | ${share(vagueAll, english.length)} |
| ${LABELS.pay} | ${share(has("pay"), n)} |
| ${LABELS.workMode} | ${share(has("workMode"), n)} |
| ${LABELS.schedule} | ${share(has("schedule"), n)} |
| ${LABELS.stepLength} | ${share(has("stepLength"), n)} |
| ${LABELS.answerTime} | **${share(has("answerTime"), n)}** |
| Says both, as the Constela clarity score asks | ${share(bothSteps, n)} |
| ${LABELS.accommodation} | ${share(has("accommodation"), n)} |

## The clarity score, at best

The Constela clarity score of each whole post, giving full marks for everything a raw post can't show: the tasks, how many requirements it has, and the work environment. The real score is this or lower, as far as the checks find what is there.

| Measure | Result |
| --- | --- |
| Median | ${percentile(scores, 50)} of 100 (the middle half: ${percentile(scores, 25)} to ${percentile(scores, 75)}) |
| Clear (80 or more), even at best | **${share(clear, n)}** |

## How hard they are to read

Flesch–Kincaid grade, on sentences of 3 to 40 words, because the dataset lost its line breaks and lists run into one long sentence. Syllables are counted by the usual vowel-group rule, so this is an estimate.

| Text | Grade |
| --- | --- |
| Whole posts, median | ${percentile(grades, 50).toFixed(1)} (the middle half: ${percentile(grades, 25).toFixed(1)} to ${percentile(grades, 75).toFixed(1)}) |
| Whole posts above grade 12, the end of high school | ${share(grades.filter((g) => g > 12).length, grades.length)} |
| The Constela sample job post | ${demoGrade.toFixed(1)} |

## Which vague phrases

| Phrase | Whole posts | For example |
| --- | --- | --- |
${phraseCounts
  .filter((p) => p.n > 0)
  .map((p) => `| ${p.id} | ${p.n} (${percent(p.n, n)}) | "${example.get(p.id)}" |`)
  .join("\n")}

## By job board

Boards with 30 or more whole posts.

| Board | Whole posts | Vague phrase | Says the pay | Says when they will answer | Median clarity at best |
| --- | --- | --- | --- | --- | --- |
${bySource.map((b) => `| ${b.s} | ${b.n} | ${percent(b.vague, b.n)} | ${percent(b.pay, b.n)} | ${percent(b.answer, b.n)} | ${b.median} |`).join("\n")}

Is the whole-post sample like the rest? Share of posts from each board:

| Board | All posts | Whole posts |
| --- | --- | --- |
${mix.map((m) => `| ${m.s} | ${percent(m.all, english.length)} | ${percent(m.complete, n)} |`).join("\n")}

## Check the checks yourself

Random matches, the same on every run.

${samples.map((s) => `**${LABELS[s.check]}**\n\n${s.shown.map((t) => `- ${t}`).join("\n") || "- No match."}`).join("\n\n")}

**A vague phrase**

${vagueSamples.map((t) => `- ${t}`).join("\n")}

## Limits

- One collection, from boards in the United States, in English. Constela's first users are in Mexico; a Mexican collection would need the detector in Spanish.
- The checks look for the plainest wording of each fact, so they miss unusual ones and a post may say more than they find. The vague-phrase detector is the one the editor uses, with its 16 patterns, not every vague phrase there is.
- Whole posts are the ones under the 4,000-character cut. If short posts differ from long ones, the board table above shows how.
`;

    const facts: PostingFacts = { postings: n, vague: vagueComplete / n, answerTime: has("answerTime") / n, clearAtBest: clear / n };
    mkdirSync("evals/results", { recursive: true });
    writeFileSync("evals/POSTINGS.md", md);
    writeFileSync(
      "evals/results/postings.json",
      JSON.stringify({ data: DATA, collected: all.length, unique: unique.length, english: english.length, whole: n, ...facts, interval: { vague: wilson(vagueComplete, n), answerTime: wilson(has("answerTime"), n) } }, null, 2) + "\n",
    );
    writeFileSync("src/lib/posting-facts.json", JSON.stringify(facts, null, 2) + "\n");
    console.log(md);

    expect(n).toBeGreaterThan(1000);
    expect(Object.values(facts).every((x) => Number.isFinite(x))).toBe(true);
  });
});
