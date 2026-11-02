# Spec: Constela for Employers

Status: draft, waiting for team review · Source: "Astralis para Empleadores: features basadas en datos" (2026-10-26) · Plan: [tasks/employers/plan.md](tasks/employers/plan.md)

## Objective

Constela helps neurodivergent people find work. This module works on the other side of the hiring table: employers write vacancies people can understand, find talent by skills without bias, run a hiring process with no surprises, and prove it with a seal they can lose.

MVP for the Mexico stage, four features on one demo flow:

1. **Clear vacancy (Vacante Clara).** A vacancy card with typical-day tasks, at most 5 essential requirements kept apart from the nice-to-have ones, salary, schedule, modality, work environment, hiring steps with durations, and default adjustments. A deterministic 0–100 clarity score explains every point it takes off. The AI only proposes text.
2. **Skills search with environment fit.** An anonymous first view, a ranking by essential skills with reasons, and environment fit shown as adjustments the employer could offer. A diagnosis is never a field, so it can never be a filter.
3. **Transparent process and adapted interview.** A required process template the candidate sees as a tracker. A structured interview: the same questions for everyone, a rubric tied to real tasks, shown 48 hours before. Alternative formats (written first stage, work sample, paid task). A one-page interviewer guide.
4. **Neuroinclusive seal (Sello Neuroincluyente).** Bronze, silver or gold from platform data, lost as soon as the data drops.

**User:** a recruiter or hiring manager at a small or medium company. They may be neurodivergent too, so the Personalize panel stays available.

**Success looks like:** the 5-minute demo script runs end to end in one browser.

### Demo script (5 minutes)

1. Paste a real vacancy. The clarity score shows what is missing and why.
2. Accept the AI rewrites. The score rises.
3. The vacancy card appears for candidates on `/jobs`.
4. Search talent: anonymous profiles ranked by skills, each with reasons and environment fit.
5. Read the interviewer guide and save the questions. Invite a candidate. They accept, see the process tracker and the questions 48 hours before, and choose a written first stage.
6. Set the interview time and mark your answer as sent. The seal reaches silver.
7. Show the CV-pair test passing.

## Decisions

1. **Same app, own section.** `/employers` has its own side menu and name ("Constela for Employers"), and the candidate menu never shows there. Not a candidate tab: one more tab adds load and can make candidates feel watched. Not a separate site: another origin means separate `localStorage`, which breaks the single-browser demo.
2. **Storage like the rest of the app.** `localStorage` plus demo fixtures. `shortcut: single-browser demo, move to a database with accounts before any real employer uses it.`
3. **Rules in code, AI for text.** The clarity score, ranking and seal are pure functions with tests. The AI (Groq through the AI SDK, same pattern as `src/lib/breakdown.ts`) only extracts and rewrites vacancy text and drafts interview questions. The employer reviews every suggestion, and candidates see nothing until the employer publishes. Only vacancy text reaches the provider, never candidate data.
4. **No diagnosis anywhere.** `WorkProfile` is a `.strict()` schema with no field for a diagnosis, age, photo or work-history gap. Barrier ids from the survey start with a diagnosis category (`autism_spectrum:sensory_load`), so they never leave the candidate side: `needsFromBarriers()` turns them into situation-based environment factors.
5. **The ranking reads essential skills only.** Environment fit is explained but never changes the order. The first draft was `0.6 × skills + 0.4 × environment`; with it, a candidate who shares a need could only move down. That screens people out for needing an adjustment, which the ADA forbids and the EEOC's guidance on AI hiring tools warns about. The CV-pair test checks it.
6. **The candidate controls their identity.** It shows only after they accept an invitation, for that vacancy only. The latest answer wins, so a later "no" hides it again.
7. **English UI in Easy Read.** Short sentences, verb first, no exclamation marks. 44 px targets, WCAG AA, reduced motion.
8. **One interface for every employer screen.** The team chose direction B, "Todo en su sitio", from three proposals. See [Interface](#interface).

## Interface

Direction B: everything stays in the same place. Research behind it: W3C COGA, GOV.UK accessibility posters, National Autistic Society and Hassell (2019), Rello and Bigham (2017).

- **The same layout on every screen.** A fixed side menu with Home, Jobs, People and Guide, then a list and its detail. Phones and tablets show a top bar, the menu at the bottom, and one screen at a time: a row opens its detail.
- **What is open lives in the URL** (`?post=`, `?part=`, `?person=`, `?job=`), so the Back gesture closes one step at a time and the menu returns to the list. It moves with `history.pushState` and calls no server.
- **One text color, no grey.** `#232B27` on `#EFEFE8`, 12.6:1. Panels `#FAFAF6`, selected areas `#DCE7E4`, buttons `#2F5F6B` with white text, outlines `#737E76`, which keep 3:1 on every background here. Peach stays for achievements only.
- **Noto Sans, 20 px on a computer and 18 px on a phone.** The theme lives on `html[data-area="employers"]`, so it reaches the page and dialogs. Colors, fonts and sizes from Personalize win over it, and the text size slider adds to the larger base. Candidate pages don't change, and they never download this font.
- **No background sky or animation here.**
- **At most one main action per screen.** Everything else is outlined. Taking or dropping an AI suggestion look the same, so the AI is never the easier path.
- **Words before numbers.** "3 things left" and "2 of 3 skills" come first. The clarity score stays as one line that says what the number means, because the features document asks for it and every score must be explained. Reduced information hides that line and the point values.
- **Plain words.** Home, Jobs, People, job post, "checked by Constela", "they say they have it", "a similar tool". Code and URLs keep `vacancy` and `talent`, because those are shared names.

## Shared objects

Agree these with the team before Phase 3. Field changes after that are announced to everyone.

| Object | Code | Written by | Read by |
| --- | --- | --- | --- |
| Vacancy (FichaVacante) | `Vacancy` in `src/lib/vacancy.ts` | Employer | `/jobs`, talent search, seal, extension |
| WorkProfile (PerfilDeTrabajo) | `WorkProfile` in `src/lib/work-profile.ts` | Candidate | Talent search, through the anonymous view |
| Permission (Permiso) | `Permission` in `src/lib/work-profile.ts` | Candidate (accept or decline) | Talent search |
| Seal (Sello) | `computeSeal()` in `src/lib/seal.ts` | Computed every time, never stored | Employer overview, `/jobs`, extension |

- **Vacancy:** `id`, `status` (draft or published), `company`, `title`, `summary`, `tasks`, `essential` and `niceToHave` (each `{ text, skill? }`), `salary` (`min`, `max`, MXN or USD, per hour, month or year), `schedule`, `modality` (remote, hybrid, on-site), `location`, `environment` (factor ids; missing means not described), `accommodations`, `process` (steps with `name`, `format`, `minutes`, `who`, `alternative`), `responseDays`.
- **WorkProfile:** `id`, `headline`, `skills` (each `{ skill, evidence: verified or declared, source? }`), `needs` (factor ids the candidate chose to share), `modalities` (empty means any), `identity` (`name`, hidden until accepted).
- **Permission:** `{ candidateId, vacancyId, status: invited, accepted or declined, at }`.
- **Vocabularies:** 18 environment factors (`ENVIRONMENT`), 37 skills (`SKILLS`) and 8 pairs of equivalent tools (`EQUIVALENT_SKILLS`), for example Excel and Google Sheets.
- **Storage:** one `localStorage` key, `employers`, version 1: `{ vacancies, permissions, responses, guideRead, interviews, bookings }`. Broken or old data loads as empty, and one bad item is dropped without losing the others. Delete my data removes the key.

## Rules v1

### Clarity score (`CLARITY_VERSION = 1`)

Starts at 100; a vacancy is clear at 80 or more. Every deduction comes with how to fix it.

| What is missing | Points |
| --- | --- |
| Salary range | −15 |
| At least 3 typical-day tasks | −10 |
| Schedule | −10 |
| Modality | −10 |
| 5 essential requirements or fewer | −10 |
| Work environment | −10 |
| A duration for every hiring step, and a response time | −10 |
| Default adjustments | −5 |
| Each vague phrase ("fast-paced", "team player", "excellent communication", 16 patterns) | −5 each, up to −20 |

The deductions add up to exactly 100. Phrases past the cap still show, so the employer can fix each one. A truly essential demand survives as a concrete task ("Answer 20 customer emails a day"), which the detector does not flag. Changing a rule means bumping the version.

### Ranking v1

For each essential requirement tagged with a skill: exact and verified counts 1, exact and declared 0.6, an equivalent tool half of that (0.5 or 0.3), missing 0. The score is the average × 100. Ties keep a stable order by id. Nothing else is read: needs, modalities, badge sources and names have no effect.

### Environment fit

For each need the candidate shared: **met** (the job offers it), **gap** (it doesn't yet, so the employer could add it) or **unknown** (the vacancy hasn't described its environment). Modality preference: met, gap, unknown or any. Employers see gaps as adjustments to offer; candidates see the same fit on `/jobs`.

### Seal v1

Thresholds are proposals until the team confirms them. A level needs all of its checks and every level below it.

| Level | Checks |
| --- | --- |
| Bronze | 90% or more of published vacancies score 80+ · interviewer guide read |
| Silver | 90% or more of published vacancies offer default adjustments and an alternative format · every due answer to a candidate sent by the promised date, with at least one sent |
| Gold | At least 5 candidate ratings averaging 4 or more out of 5 |

Drafts don't count. An unanswered response counts once it is overdue. Because nothing is stored, the seal drops as soon as a metric does. The demo reaches silver; gold needs real candidates.

### CV-pair test

From the features document, it runs on every `npm test`:

- 10 pairs where B is A plus one verified merit with a disability-related source, plus shared needs. B ranks above A in 10 of 10.
- The same profile with and without that text and those needs gets the same score, 10 of 10.

### AI tasks (`POST /api/employer-ai`)

| Task | Request | Response |
| --- | --- | --- |
| `extract` | `{ task, text }`: the pasted posting, up to 8,000 characters | `{ vacancy }`: a draft without `id` and `status`, and without `company` if the posting doesn't name one |
| `rewrite` | `{ task, text }`: one line with a vague phrase, up to 400 characters | `{ text }`: the new line. A line with nothing vague comes back unchanged, with no AI call |
| `interview` | `{ task, title, tasks, essential }`: `essential` is a list of requirement texts | `{ questions: [{ requirement, question, strong, basic }] }` |

Errors match `/api/breakdown`: `invalid_input` 400, `not_configured` 503, `failed` 502, `timeout` 504.

Code checks every answer, because an employer may accept a suggestion without reading it closely:

- **Extract copies; it doesn't add.** Every number (salary, durations, response time) must appear in the posting. If it doesn't, it is dropped and the clarity score keeps asking for it, so "1 hour" or "within a week" may need typing in by hand. Skills, environment factors, modalities and formats outside the vocabularies are dropped, never guessed. Vague phrases stay in the draft so the score can flag them. An empty environment from the AI counts as not described: only the employer can say a job offers none of these.
- **A rewrite doesn't invent facts.** A missing fact comes back as a [bracket] for the employer to fill in, and without a bracket a rewrite can only take words away. A rewrite that breaks this, keeps a vague phrase, adds a number the line didn't have, or doesn't fit its field is rejected, and the employer keeps the hint from the clarity score. Next to a bracket the code can't tell a joining word from a new fact, so the prompt's examples and the employer's review cover that case.
- **Every interview question is tied to an essential requirement.** Anything else is dropped. The rubric judges the work, never eye contact, voice, speed or confidence, and stays at the level of the requirement.
- **One more try.** The model sometimes breaks the schema or these rules, so each task gets a second try inside the same 15 seconds. If both fail, the employer gets a calm message and a Try again button.

Measured with the real key on the default model: extract takes 2 to 5 seconds, and about 8 of 10 rewrites come back on the first press. Groq allows 8,000 tokens a minute and each rewrite uses about 1,000, so about 8 rewrites a minute.

### Vacancy editor

- **Six parts.** The job, Pay and hours, Typical day, What you need, Workplace, Hiring steps. Each says Done, how many things to fix, or Empty, and `partStatuses()` gives every screen the same count.
- **Paste or type.** The AI fills the parts. Without AI the same parts work by hand, with the score and the phrase hints.
- **Drafts save themselves.** As soon as a draft has a title and a company, each change is stored and the page says "Saved". Candidates see nothing until Publish.
- **A live job post waits for Save changes,** so candidates never read half a sentence.
- **Nothing is lost by leaving.** Work that can't be saved yet stays in the Jobs list for as long as the tab is open, and a reload warns first.
- **A [bracket] stops at the suggestion.** "Use this version" stays off until every bracket is filled, so an AI blank never enters the card. Brackets in the employer's own text are left alone.
- **The score reads the card, not the pasted text.** Vague phrases are marked when the employer pastes. If the AI leaves one out of the card, candidates won't see it, so it doesn't count.
- **What saving needs.** A draft needs a title and a company, like every stored vacancy. Publishing also needs one hiring step. The clarity score guides and never blocks.
- **The process template has names and formats only.** A duration is a fact, so the employer gives it, the same rule the AI follows.
- **Candidates see it on `/jobs`** with their fit, read on their own device. Their needs never reach the employer.

### Talent search

- **Pick a published vacancy.** A draft can't take invitations: there is nothing yet for the candidate to read.
- **The order comes from `rankCandidates()` and nothing else.** There are no filters, and the page says that needs never change the order. People with none of the skills stay out of the list, and a line says how many. A vacancy with no skill tags asks the employer to add them.
- **Cards are built from the anonymous view.** `talentRows()` gives a card a name only after a yes, so a card has no name to show by mistake.
- **Reasons explain the order.** The list says "2 of 3 skills, 1 similar", and the detail says "SQL: they say they have it" or "Excel: they use Google Sheets, a similar tool, checked by Constela". The page says that a checked skill counts more and a similar tool counts half.
- **Fit reads as adjustments.** "You already offer" and "You could offer", never as something the person lacks.
- **Invite adds an `invited` permission.** Answers stay in order and the last one wins. After a no there is no way to invite that person again for that vacancy.

### Structured interview and invitations

- **The same questions for everyone.** Questions belong to the vacancy, not the candidate. They come from the AI, or from a fixed template with no AI, and nothing is saved until the employer saves it.
- **The question checker.** Hypothetical and vague questions get a warning and a concrete version. Questions about the person (age, health, family) stop the save. The check reads what is asked of the person, so a job about "health records" isn't flagged.
- **The candidate decides on `/invitations`.** They see the whole process before answering. Yes and no look the same and take one press, and they can change their answer. A no hides their name again.
- **48 hours before.** Once the employer sets the date, the questions open 48 hours before it. A shorter notice gets a calm note, not a block.
- **Alternative formats.** On a step that offers one, the candidate picks it and the employer sees the choice.
- **Answers the employer owes.** A yes creates an answer due by the date the vacancy promised, and the employer marks it as sent. This feeds the seal. A no cancels an answer not sent yet, so a candidate who leaves never counts against the employer.

## Contract with the other modules

| Teammate | What we need |
| --- | --- |
| Luis (Profile, My plan) | Review the shared files: `SiteNav` shows nothing on `/employers`, where `EmployerNav` takes over, and sets `data-area` on `<html>`. `DeleteMyData` removes the `employers` key and now reloads the page, so hidden pages lose what they hold in memory. `PersonalizationPanel` takes a `className` and names the employer defaults. Employer flows will call `addStepToPlan()` ("Read your interview questions") and `markEvent()`. |
| Zahid and Juan (Jobs) | Review `<PublishedVacancies />`, added above `<JobSearch />` in `src/app/jobs/page.tsx`. It shows nothing until a vacancy is published. Agree on wording: their badge stays "Verified company", ours is "Neuroinclusive seal". A new barrier subtype needs a line in `needsFromBarriers()`; a test fails until it has one. |
| Evy (Interview) | Candidates read the structured questions on `/invitations` for now. Say if they should also appear on `/interview`. |
| Regina (extension) | `GET /api/public/seal` and `GET /api/public/vacancies/[id]` wait for a database: vacancies live in the browser, so a server has nothing to return yet. |

## Tech Stack

Same as the app: Next.js 16 App Router, React 19, TypeScript, Zod 4, AI SDK 7 with Groq, Vitest. No new dependencies.

## Commands

```text
Dev:   npm run dev
Build: npm run build
Lint:  npm run lint
Types: npx tsc --noEmit
Test:  npm test
```

## Project Structure

```text
src/lib/vacancy.ts                → Vacancy, vocabularies, clarity score, phrase detector, demo vacancy
src/lib/work-profile.ts           → WorkProfile, Permission, anonymous view, barrier-to-needs map, fit, ranking, demo pool
src/lib/seal.ts                   → seal levels and checks
src/lib/employer-ai.ts            → AI tasks: extract, rewrite, interview (Phase 2)
src/app/api/employer-ai/route.ts  → validated AI boundary (Phase 2)
src/lib/employer-store.ts         → localStorage for vacancies, permissions, responses, guide (Phase 3)
src/lib/vacancy-editor.ts         → the editor's rules: form to vacancy, what saving needs, the six parts, phrase marks (Phase 4)
src/lib/employer-ai-client.ts     → the browser side of the AI route (Phase 4)
src/lib/interview-questions.ts    → question checker, fixed questions, the 48-hour rule (Phase 6)
src/lib/invitations.ts            → what an invited candidate sees, and the step in My plan (Phase 6)
src/lib/employer-home.ts          → what Home shows: the next step and the three boxes (redesign)
src/app/invitations/              → the candidate's invitation view (Phase 6)
src/app/employers/                → layout, Home, jobs (vacancies), people (talent), guide, seal
src/components/employers/         → side menu, list and detail, job post editor, people, guide, seal, published vacancies
src/components/site-nav.tsx       → candidate header: shows nothing on /employers and marks the section on <html>
```

## Code Style

Follow CLAUDE.md. Pure functions in `src/lib`; components only render and call them. `.strict()` Zod schemas at every boundary. Every shortcut gets a `shortcut: <limit>, <when to upgrade>` comment.

```ts
const { score, issues } = clarityScore(vacancy); // issues: [{ id: "salary", points: 15, fix: "Add the salary range." }]
const ranked = rankCandidates(vacancy, profiles); // [{ id, score, matches: [{ requirement, skill, via?, evidence?, weight }] }]
```

## Testing Strategy

- Unit tests for every rule, vocabulary mapping and privacy rule (done in Phase 1).
- The CV-pair test on every ranking change.
- The AI route with `MockLanguageModelV4`, including a test that only vacancy text reaches the provider.
- The shared menu with `react-dom/server`: each side sees only its own links.
- Manual: the demo script at 375 px and desktop, keyboard only, with a screen reader, and with the Reading settings on.

## Boundaries

- **Always:** explain every score; let the employer review AI output before it is published; send only vacancy text to the AI; show identity only after the candidate accepts.
- **Ask first:** storing candidate data outside the browser; adding or renaming a skill or environment factor (they are shared contracts); changing ranking weights or seal thresholds.
- **Never:** a diagnosis field or filter; barrier ids or their categories on the employer side; a ranking that reads needs, names, age or work-history gaps; red or "overdue" anywhere a candidate looks.

## Success Criteria

- [x] Clarity score, ranking, environment fit, seal and privacy rules are pure functions with tests.
- [x] The CV-pair test passes 10 of 10, and sharing needs or disability-related text never changes a score.
- [x] An employer turns a pasted vacancy into a clear card (80+) and publishes it; candidates see it on `/jobs`.
- [x] Talent search shows anonymous profiles ranked by skills, with reasons and fit; identity shows only after the candidate accepts.
- [x] An invited candidate sees the process tracker, the questions 48 hours before, and can choose an alternative format.
- [x] The seal panel shows the level, every check and how to reach the next level.
- [x] Usable at 375 px and by keyboard alone, at the largest text, with AA contrast.
- [ ] A real screen reader reads every screen (the accessibility tree already has the right names).
- [x] `/impeccable critique` issues fixed (reduced run: the detector and one reviewer, with no separate agents).
- [x] The 5-minute demo script runs end to end.

## Open Questions

1. Seal thresholds (90%, 5 ratings, average 4): confirm with Angel.
2. Talent pool: demo profiles only for the MVP, or a "share my work profile" step for real candidates? That would need skills in the Profile (Luis).
3. Where candidates read interview questions: `/invitations` for now, or also `/interview` (Evy).
4. Badge wording next to the jobs page's "Verified" badge.
5. Verified skills are labelled "demo" until a skills-check or course module exists.
6. Should employers see shared needs before a candidate says yes? Today they do, as the features document asks. The order can't change, but a person could still skip someone because of a need. The other option is to show needs only after a yes, which gives employers less to plan adjustments with.
