# What real job posts tell a candidate

6,450 job posts collected in 2026 from 7 job boards in the United States (`backend/data/raw/jobs/jobs_usa_full_backup_cleaned.json`), read with the same vague-phrase detector the Constela editor uses, and with plain checks for what a candidate needs to know before applying. Run it again with `npm run eval:postings`: it takes seconds and needs no network. Every rate has a 95% Wilson interval.

## The posts

| Step | Posts |
| --- | --- |
| Collected | 6,450 |
| The same post from two boards, kept once | 5,879 |
| In English, which the detector reads | 5,854 |
| **Whole**: the collector cut 53% of descriptions at about 4,000 characters | **2,729** |

Pay ranges, hiring steps and adjustments usually come at the end of a post, so everything that needs the whole text is measured on the 2,729 whole posts. Vague phrases are also counted on all 5,854, where a cut text can only hide more of them.

## What they leave out

| Measure | Whole posts |
| --- | --- |
| Use at least one vague phrase | **875 of 2729 (32%, 95% CI 30–34%)** |
| ...counted on every post, cut or whole (a floor) | 2091 of 5854 (36%, 95% CI 35–37%) |
| Says the pay | 306 of 2729 (11%, 95% CI 10–12%) |
| Says if it is remote, hybrid or on-site | 1325 of 2729 (49%, 95% CI 47–50%) |
| Says the working days or hours | 121 of 2729 (4%, 95% CI 4–5%) |
| Says how long a hiring step takes | 8 of 2729 (0.3%, 95% CI 0.1–0.6%) |
| Says when they will answer | **0 of 2729 (0%, 95% CI 0–0.1%)** |
| Says both, as the Constela clarity score asks | 0 of 2729 (0%, 95% CI 0–0.1%) |
| Mentions adjustments (accommodations), even in a legal sentence | 121 of 2729 (4%, 95% CI 4–5%) |

## The clarity score, at best

The Constela clarity score of each whole post, giving full marks for everything a raw post can't show: the tasks, how many requirements it has, and the work environment. The real score is this or lower, as far as the checks find what is there.

| Measure | Result |
| --- | --- |
| Median | 55 of 100 (the middle half: 50 to 60) |
| Clear (80 or more), even at best | **18 of 2729 (0.7%, 95% CI 0.4–1%)** |

## How hard they are to read

Flesch–Kincaid grade, on sentences of 3 to 40 words, because the dataset lost its line breaks and lists run into one long sentence. Syllables are counted by the usual vowel-group rule, so this is an estimate.

| Text | Grade |
| --- | --- |
| Whole posts, median | 13.4 (the middle half: 12.0 to 14.9) |
| Whole posts above grade 12, the end of high school | 2033 of 2726 (75%, 95% CI 73–76%) |
| The Constela sample job post | 6.7 |

## Which vague phrases

| Phrase | Whole posts | For example |
| --- | --- | --- |
| communication | 434 (16%) | "Excellent verbal and written communication" |
| fast-paced | 359 (13%) | "fast-paced" |
| self-starter | 68 (2%) | "self-starter" |
| ambiguity | 58 (2%) | "Comfortable with ambiguity" |
| organized | 49 (2%) | "Excellent organizational skills" |
| dynamic | 37 (1%) | "dynamic team" |
| interpersonal | 36 (1%) | "interpersonal skills" |
| personality | 36 (1%) | "high energy" |
| team-player | 34 (1%) | "team player" |
| pressure | 30 (1%) | "under pressure" |
| multitasking | 26 (1%) | "multitask" |
| other-duties | 23 (1%) | "Other duties as assigned" |
| culture-fit | 13 (0%) | "Culture Fit" |
| many-hats | 11 (0%) | "wear many hats" |
| rockstar | 5 (0%) | "unicorn" |
| ground-running | 4 (0%) | "hit the ground running" |

## By job board

Boards with 30 or more whole posts.

| Board | Whole posts | Vague phrase | Says the pay | Says when they will answer | Median clarity at best |
| --- | --- | --- | --- | --- | --- |
| dice | 341 | 33% | 39% | 0% | 60 |
| yc | 512 | 35% | 4% | 0% | 50 |
| greenhouse | 1493 | 31% | 8% | 0% | 50 |
| ashby | 172 | 41% | 9% | 0% | 50 |
| remoteok | 121 | 31% | 9% | 0% | 60 |
| lever | 83 | 4% | 0% | 0% | 50 |

Is the whole-post sample like the rest? Share of posts from each board:

| Board | All posts | Whole posts |
| --- | --- | --- |
| dice | 30% | 12% |
| yc | 27% | 19% |
| greenhouse | 26% | 55% |
| ashby | 12% | 6% |
| remoteok | 3% | 4% |
| lever | 1% | 3% |
| remotive | 0% | 0% |

## Check the checks yourself

Random matches, the same on every run.

**Says the pay**

- …ule: Monday?Friday | 8:00 AM?5:00 PM Saturday: One Saturday per month Pay: $22?$47/Flat Rate, based on skill level Pay Schedule: Weekly Top Technic…
- …hs. Access to frontier Claude models and internal evaluation tooling. Compensation: $100,000–$167,000 USD for the four-month fellowship (equivalent to $300,…
- …reflect the base salary only, and do not include equity, or benefits. Base Salary $160,000 — $200,000 USD Why Discord? Discord plays a uniquely important…
- …emote: Hybrid Remote Area of Interest: Information Systems/Technology Pay Range: $83,782.40/Yr. - $134,035.20/Yr. (Based on 40 hours per week, otherwise…
- …rn, and margin. Availability during Pacific or Hawaii business hours. Compensation $150â$165 per hour. Long-term 1099 independent contractor engagement.…

**Says if it is remote, hybrid or on-site**

- …of one of our offices (SF, NY, London, or Berlin), the role includes in-office anchor days on Monday, Tuesday, and Friday. If you're located beyond…
- …alue they get of our platform and the return on investment. This is a hybrid technical and commercial role. It is commercial in the sense that you…
- …tion E, TILA and Regulation Z, UDAAP, or comparable requirements. #LI-Onsite #LI-LB1 Below is the base salary offered for this role and level of e…
- …team oriented environment. Epic application focus: HIM Work location: On site in San Antonio, TX Why Join University Health? \t Be part of a missio…
- …e You'll Work This role will be based in our Seattle office. We are a hybrid environment that combines the energy and connections of being in the…

**Says the working days or hours**

- …th short and long-form. Schedule. Fully remote, with required overlap 9:00 AM to 5:00 PM Eastern Time, Monday through Friday. Technical. Wired inte…
- …ill run in a full-time capacity during typical business hours between Monday-Fri…
- …ncy in Microsoft Office suite. Availability: Ability to work a strict 9:00 AM â 5:00 PM EST schedule from an offshore location. ð Fully remote…
- …rkand the resources to build a career you can be proud of. 1st shift, Monday - Friday 7:00am - 3:30pm As the EHS Supervisor, you?ll oversee the EHS team to…
- …will be cold calling to Australian prospects You will be working from 6 am PST- 3pm PST This is a REMOTE work Qualifications Cold calling Neutra…

**Says how long a hiring step takes**

- …Previous founder or early engineer at seed/series-A startup About the interview Non-technical Phone Screen (30 mins) Practical Coding Interview (45 mins) Work Trial (2-3 days in person,…
- …ng technical blogs to establish Onyx is leader in the space About the interview Non-technical Phone Screen (30 mins) ML Interview (45 mins) Practical Coding Interview (30 mins) Work Tri…
- …gether how that might fit in with what we’re working on at FleetWorks 45-min live-coding interview with an engineer who you'll work with if you join, so that we can get…
- …passionate about making work more seamless and intelligent. About the interview Intro Call (30 minutes) Sales Process Review (30 minutes) Mock Sales Call (30 minutes) Onsit…

**Says when they will answer**

- No match.

**Mentions adjustments (accommodations), even in a legal sentence**

- …l is committed to providing access, equal opportunity, and reasonable accommodation for individuals with disabilities in employment, its services, pro…
- …to People on recruiting and hiring practices, policies and handbooks, accommodations, investigations, performance/separations, and employment document…
- …heck every single box. Please, let us know if you need any reasonable accommodations during the interview process.…

**A vague phrase**

- …and influencing direction through strong technical judgment Strong written and verbal communication skills, with the ability to explain technical tradeoffs cle…
- …ng work ethic and enthusiasm for learning, who thrives in a fast-paced, dynamic environment. Knowledge, Skills, and Abilities Prof…
- …o multi-task Strong communication skills Ability to work in fast paced, high pressure environment Strong quantitative skills Stron…
- …ing critical thinking, analysis, and innovative techniques. Strong verbal and written communication skills. Work well in a team environment. Have the ability t…
- …whilst upholding the standards required by the business. A team player, capable of interacting with a varied customer base. Basic…
- …aging technology Excellent presentation, communication, and interpersonal skills, with the ability to convey complex technical and business…

## Limits

- One collection, from boards in the United States, in English. Constela's first users are in Mexico; a Mexican collection would need the detector in Spanish.
- The checks look for the plainest wording of each fact, so they miss unusual ones and a post may say more than they find. The vague-phrase detector is the one the editor uses, with its 16 patterns, not every vague phrase there is.
- Whole posts are the ones under the 4,000-character cut. If short posts differ from long ones, the board table above shows how.
