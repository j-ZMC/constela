# Employer AI evaluation

Model `openai/gpt-oss-20b` on Groq, 2026-11-04. 42 cases, 48 rewrite answers read one by one, 61,066 tokens, 15 minutes.
Run it again with `npm run eval:ai`. Every rate has a 95% Wilson interval, because the samples are small.

## What reaches the employer

| Check | Result |
| --- | --- |
| Rewrites with an invented number, a fact with no [bracket], a vague phrase, or too long | **0 of 17 (0%, 95% CI 0–18%)** |
| Drafts with a number the posting never stated | **0 of 6 (0%, 95% CI 0–39%)** |

The evaluation fails if either is above zero.

## Rewrites (32 lines, 2 for each of the 16 vague phrases)

| Measure | Result |
| --- | --- |
| A rewrite reached the employer | 17 of 32 (53%, 95% CI 36–69%) |
| ...on the first answer | 16 of 32 (50%, 95% CI 34–66%) |
| Answers from the model that our guards refused | 31 of 48 (65%, 95% CI 50–77%) |
| ...kept a vague phrase | 0 |
| ...added a fact with no [bracket] | 31 |
| ...added a number | 0 |
| ...too long, empty or broken | 0 |
| Delivered rewrites that kept every fact of the line | 7 of 7 (100%, 95% CI 65–100%) |
| Delivered rewrites that ask for a fact with a [bracket] | 12 of 17 (71%, 95% CI 47–87%) |
| Time to an answer | 1.2 s median, 2.7 s at the 95th percentile |

Examples that reached the employer:

- "Answer 20 customer emails a day in a fast-paced team" → "Answer 20 customer emails a day in a team"
- "Join our dynamic team of data analysts" → "Join our team of data analysts"
- "Strong organizational skills to manage 3 project calendars" → "Manage 3 project calendars"
- "Meet tight deadlines in a high-pressure warehouse" → "Meet tight deadlines in a warehouse"

Answers the guards stopped:

- "Thrive in a dynamic work environment with weekly releases" → "Work on tasks with weekly releases." (adds a fact with no [bracket])
- "Thrive in a dynamic work environment with weekly releases" → "Manage work that releases weekly" (adds a fact with no [bracket])
- "Team player who reviews code with other developers" → "Review code collaboratively with other developers" (adds a fact with no [bracket])
- "Team player who reviews code with other developers" → "Review code with other developers" (adds a fact with no [bracket])

## Reading a pasted posting (6 postings)

| Measure | Result |
| --- | --- |
| A draft reached the employer | 6 of 6 (100%, 95% CI 61–100%) |
| Numbers the model invented, before the guards | 1 of 17 |
| Numbers it invented that reached the employer | 0 |
| Company right, and left empty when the posting names none | 6 of 6 (100%, 95% CI 61–100%) |
| Salary right, and left empty when there is none | 6 of 6 (100%, 95% CI 61–100%) |
| Work mode right | 6 of 6 (100%, 95% CI 61–100%) |
| Answer time right, and left empty for "within a week" | 6 of 6 (100%, 95% CI 61–100%) |
| Every step duration right | 6 of 6 (100%, 95% CI 61–100%) |
| Vague phrases kept, so the clarity score can flag them | 6 of 6 (100%, 95% CI 61–100%) |
| Time to an answer | 2.0 s median, 4.7 s at the 95th percentile |

## Interview questions (4 job posts)

| Measure | Result |
| --- | --- |
| Questions arrived | 4 of 4 (100%, 95% CI 51–100%) |
| Essential requirements with a question | 10 of 10 (100%, 95% CI 72–100%) |
| Questions about the person (age, health, family): the save stops | 0 of 10 (0%, 95% CI 0–28%) |
| Questions about an imagined situation: the employer is warned | 0 of 10 (0%, 95% CI 0–28%) |
| Vague questions: the employer is warned | 0 of 10 (0%, 95% CI 0–28%) |
| Time to an answer | 1.5 s median, 1.7 s at the 95th percentile |

## Limits

- Fixed cases written by the team, in English. They show how the model and the guards behave, not how every posting will go.
- The re-check is written apart from the guards but follows the same rules, so a new kind of invented fact would slip past both. A person still reads every suggestion before using it.
- Rate-limit waits from the provider are not counted as failures: the case runs again.
