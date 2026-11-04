# Ranking fairness audit

Ranking v1 (`src/lib/work-profile.ts`), 2026-11-04. 300 synthetic job posts, each with its own pool of 30 synthetic people: 9,000 people, 142,889 checks, 18 s.
Seeded, so every run gives the same numbers. Run it again with `npm run eval:fairness`, offline.

The CV-pair test in `npm test` checks one pair of people. This checks the same promise, and six more, on every person here, by running the real ranking again with one thing changed.

## The ranking's promises

| Promise | Checks | Broken |
| --- | --- | --- |
| Sharing, hiding, adding or removing needs and work modes changes no score and no place | 27,000 | **0** |
| A name, a headline or who checked a skill changes no score and no place | 9,000 | **0** |
| A skill the job doesn't ask for changes no score and no place | 8,638 | **0** |
| The same people in any input order get the same order and scores | 900 | **0** |
| More of a skill the job asks for never lowers a score or a place | 42,061 | **0** |
| "What would change the order" shows the place the ranking really gives | 23,824 | **0** |
| No single skill change moves anyone higher than the best change shown | 31,466 | **0** |

The audit fails if any is above zero. Its own tests (`evals/fairness.test.ts`) give it a ranking broken on purpose for each promise, and it catches every one.

## Who reaches the top 5

A person counts when they are in the top 5 of their pool with a score above 0. Skills here are drawn the same way for everyone, so this shows the method, not the world.

| Group | People | In the top 5 |
| --- | --- | --- |
| Shares no need | 4,443 | 729 of 4443 (16%, 95% CI 15–18%) |
| Shares 1 or 2 needs | 2,296 | 373 of 2296 (16%, 95% CI 15–18%) |
| Shares 3 or more needs | 2,261 | 398 of 2261 (18%, 95% CI 16–19%) |

Impact ratio, the lowest rate over the highest: 0.92 (sharing a need or not: 0.97). The four-fifths rule used in US hiring asks for 0.8 or more.

## If the inputs carry a bias

The ranking never reads needs. It does read whether Constela checked a skill: a checked skill counts 1, a stated one 0.6. So if people who share a need got their skills checked less often, fewer of them would reach the top, with the ranking working exactly as designed. Same people and same skills below; only how often a skill was checked changes.

| Skills checked: shares a need / shares none | Impact ratio now | If a stated skill counted the same as a checked one |
| --- | --- | --- |
| 65% / 65% | 0.97 | 0.97 |
| 50% / 65% | 0.81 | 0.97 |
| 35% / 65% | 0.60 (under 0.8) | 0.97 |
| 20% / 65% | 0.40 (under 0.8) | 0.97 |

At a gap of 30 points the ratio falls under 0.8. The checked-skill weight passes an unequal input straight through, while counting every skill the same doesn't. That is the trade: the weight rewards proof, so proof has to be equally easy to get. With real people, measure who gets their skills checked before trusting the 0.6.

## Ties at the cut

Pools where the 5th and 6th places had the same score: 196 of 300 (65%, 95% CI 60–70%). In those, the order by id decided who made the top 5. The order is fixed, so it is fair between runs, but it means nothing about the people. People with the same score should be shown as tied.

## Limits

- Synthetic people and job posts. This shows what the code does, every time, not what happens to real people.
- Groups come from the number of needs shared, the only group information a profile has. A profile has no diagnosis, age, gender or race, so none of those can be measured here, or leak into the ranking.
- The four-fifths rule (US Uniform Guidelines on Employee Selection Procedures, 1978) is a rule of thumb that flags a gap. It doesn't prove fairness, or its absence.
