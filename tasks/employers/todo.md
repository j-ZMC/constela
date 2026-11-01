# Tasks: Constela for Employers

Plan: [plan.md](plan.md) · Spec: [SPEC-employers.md](../../SPEC-employers.md)

## Phase 1: Shared objects and rules

## Task 1: Vacancy, vocabularies, clarity score and phrase detector

**Description:** Create `src/lib/vacancy.ts` with the `Vacancy` schema, the environment and skill vocabularies with equivalent tools, `clarityScore()` v1, `findExclusionaryPhrases()`, `offersAlternativeFormat()` and a clear demo vacancy.

**Acceptance criteria:**
- [x] The demo vacancy scores 100; every rule in the SPEC table deducts its points with a fix
- [x] Phrases cost 5 each up to 20 and are all still listed; the worst vacancy scores 0, never less
- [x] Concrete tasks that share words with a vague phrase ("outgoing calls", "dynamic pricing") are not flagged

**Verification:**
- [x] Tests pass: `npm test`
- [x] Types and lint pass

**Dependencies:** None

**Files:** `src/lib/vacancy.ts`, `src/lib/vacancy.test.ts`

**Estimated scope:** M

## Task 2: WorkProfile, Permission, needs mapping, fit, ranking and the CV-pair test

**Description:** Create `src/lib/work-profile.ts` with the `.strict()` `WorkProfile` schema, `Permission`, `anonymize()`, `identityFor()`, `needsFromBarriers()`, `compatibility()`, `rankCandidates()` and 15 demo profiles from many kinds of work.

**Acceptance criteria:**
- [x] A diagnosis, age or photo field is rejected; the anonymous view never contains the name
- [x] Identity shows only after acceptance, for that vacancy only, and hides again after a later "no"
- [x] Every barrier in the survey maps to at least one environment factor and no category comes out
- [x] Ranking weights match the SPEC; untagged requirements are ignored; ties are stable
- [x] CV-pair test: B ranks above A in 10 of 10, and text or needs alone never change a score

**Verification:**
- [x] Tests pass: `npm test`
- [x] Types and lint pass

**Dependencies:** Task 1

**Files:** `src/lib/work-profile.ts`, `src/lib/work-profile.test.ts`

**Estimated scope:** M

## Task 3: Seal levels

**Description:** Create `src/lib/seal.ts` with `computeSeal(input, now)`: bronze, silver and gold checks from the SPEC, each with a plain-language detail.

**Acceptance criteria:**
- [x] No seal before anything is published; drafts never count
- [x] Each level needs all of its checks and the levels below; the level drops as soon as a metric does
- [x] An unanswered response counts against the seal only once it is overdue

**Verification:**
- [x] Tests pass: `npm test`

**Dependencies:** Task 1

**Files:** `src/lib/seal.ts`, `src/lib/seal.test.ts`

**Estimated scope:** S

## Checkpoint 1
- [x] `npm test`, `npm run lint` and `npx tsc --noEmit` pass
- [ ] Shared objects reviewed with the team

## Phase 2: AI route

## Task 4: Employer AI tasks and `POST /api/employer-ai`

**Description:** Copy the `breakdown.ts` pattern. `extract` turns pasted text into a draft `Vacancy` with skills from the vocabulary; `rewrite` returns a concrete version of a flagged phrase; `interview` drafts the same questions for everyone, each with a rubric tied to an essential task. Read `node_modules/next/dist/docs/` for route handlers first.

**Acceptance criteria:**
- [x] The request schema is `.strict()` and accepts only vacancy text and the task name
- [x] Output passes `vacancySchema` after `normalize()`; unknown skills are dropped, not guessed
- [x] Missing key, invalid input, timeout and provider errors return the same typed codes as breakdown

**Verification:**
- [x] Tests pass with `MockLanguageModelV4`, including "only vacancy text reaches the provider"
- [x] The schema sent to Groq meets its strict-mode rules, guarded by a test
- [x] With a real Groq key, all three tasks return good results and extracting the demo vacancy text takes under 15 s

**Dependencies:** Task 1

**Files:** `src/lib/employer-ai.ts`, `src/lib/employer-ai.test.ts`, `src/app/api/employer-ai/route.ts`, `src/app/api/employer-ai/route.test.ts`

**Estimated scope:** M

## Phase 3: Employers shell

## Task 5: Layout, menu, hidden candidate menu, intro link and store

**Description:** `/employers` layout with "Constela for Employers" and its own menu (Overview, Vacancies, Talent, Guide), keeping the Personalize panel. `SiteNav` swaps to this menu there, so the two menus never show together (Luis to review). A quiet "Hiring? Constela for Employers" link on the intro, and a way back on the overview. `employer-store.ts` saves vacancies, permissions, responses and "guide read", versioned and validated. Delete my data removes the new key.

**Acceptance criteria:**
- [x] The candidate menu never shows on `/employers`, and the employer menu never shows elsewhere
- [x] Broken or old data in storage loads as empty, without crashing
- [x] Targets are 44 px; the menu works with the keyboard
- [x] At the largest text, on a phone, nothing scrolls sideways and every control stays on screen
- [ ] A real screen reader reads the menu (the accessibility tree already has the right names)

**Verification:**
- [x] Store and menu tests pass; checked in Chrome at 375 px and desktop

**Dependencies:** Phase 1

**Files:** `src/app/employers/layout.tsx`, `src/app/employers/page.tsx`, `src/app/employers/vacancies/page.tsx`, `src/app/employers/talent/page.tsx`, `src/app/employers/guide/page.tsx`, `src/components/site-nav.tsx`, `src/components/site-nav.test.ts`, `src/components/intro-actions.tsx`, `src/components/personalization-panel.tsx`, `src/components/delete-my-data.tsx`, `src/app/globals.css`, `src/lib/employer-store.ts`, `src/lib/employer-store.test.ts`

**Estimated scope:** M

## Phase 4: Clear vacancy

## Task 6: Vacancy editor with live clarity score

**Description:** Paste text → extract → review the card → see the score and each fix → accept or edit rewrites (the score updates live) → fill the process template → publish. Vague phrases are highlighted in the pasted text.

**Acceptance criteria:**
- [x] Nothing from the AI is saved until the employer accepts it
- [x] A rewrite with a [bracket] can't be saved until the employer fills it in
- [x] Without AI, the employer can fill the card by hand and still get the score and phrase hints
- [x] Publishing needs a title, company and at least one hiring step
- [x] Unsaved work survives moving around the menu, and leaving or reloading asks first

**Verification:**
- [x] Tests pass; demo script steps 1 and 2 checked in Chrome with simulated AI answers
- [x] Demo script steps 1 and 2 with a real Groq key

**Dependencies:** Tasks 4 and 5

**Files:** `src/app/employers/vacancies/page.tsx`, `src/components/employers/vacancy-workspace.tsx`, `vacancy-editor.tsx`, `vacancy-fields.tsx`, `phrase-help.tsx`, `clarity-panel.tsx`, `src/lib/vacancy-editor.ts`, `src/lib/vacancy-editor.test.ts`, `src/lib/employer-ai-client.ts`, `src/lib/employer-store.ts`

**Estimated scope:** L

## Task 7: Published vacancies on `/jobs`

**Description:** `<PublishedVacancies />` shows published cards on `/jobs` with the seal level and, when the candidate has a barrier survey, the environment fit from `needsFromBarriers()`.

**Acceptance criteria:**
- [x] One line added to `src/app/jobs/page.tsx`, plus its import
- [ ] Zahid and Juan agree
- [x] Fit wording is calm: "This job offers 3 of the 4 things you asked for"

**Verification:**
- [x] Demo script step 3 checked in Chrome

**Dependencies:** Task 6

**Files:** `src/components/employers/published-vacancies.tsx`, `src/app/jobs/page.tsx`

**Estimated scope:** S

## Phase 5: Talent search

## Task 8: Anonymous ranked profiles, fit and invitations

**Description:** Pick a vacancy and see the demo pool ranked by `rankCandidates()`, each with its reasons ("SQL: verified", "Excel: via Google Sheets, counts half") and fit shown as adjustments to offer. "Invite" creates an `invited` permission.

**Acceptance criteria:**
- [x] The page states that needs never change the order
- [x] Names appear only after the candidate accepts (checked with a stored answer until Task 10 lets a candidate give one)
- [x] A vacancy without skill-tagged requirements asks the employer to tag them

**Verification:**
- [x] Tests pass; demo script step 4 checked in Chrome at 375 px and desktop

**Dependencies:** Task 5

**Files:** `src/app/employers/talent/page.tsx`, `src/components/employers/talent-search.tsx`, `src/lib/work-profile.ts`, `src/lib/employer-store.ts`

**Estimated scope:** M

## Phase 6: Process and interview

## Task 9: Structured interview, question checker and interviewer guide

**Description:** Draft questions from the essential requirements (AI `interview`, or a fixed template without AI), flag hypothetical or vague questions with a concrete version, and a one-page guide with "I read it".

**Acceptance criteria:**
- [x] Every candidate for a vacancy gets the same questions and rubric
- [x] "I read it" feeds the seal's training check
- [x] A question about the person can't be saved

**Verification:**
- [x] Tests for the question checker; the guide and real AI questions checked in Chrome

**Dependencies:** Task 4

**Files:** `src/lib/interview-questions.ts`, `src/app/employers/guide/page.tsx`, `src/components/employers/interviewer-guide.tsx`, `src/components/employers/interview-questions.tsx`, `src/lib/employer-store.ts`

**Estimated scope:** M

## Task 10: The candidate's invitation view

**Description:** The candidate accepts or declines an invitation, sees the process as a tracker (steps, format, duration, who, response date), reads the questions when 48 hours or less remain, and picks the alternative format. Accepting adds "Read your interview questions" to My plan with `addStepToPlan()`.

**Acceptance criteria:**
- [x] No red and no "overdue"; every step says how long it takes
- [x] Declining is as easy as accepting and hides the identity again
- [x] A no cancels an answer not sent yet, so it never counts against the seal

**Verification:**
- [x] Demo script step 5 checked in Chrome at 375 px and desktop

**Dependencies:** Tasks 8 and 9

**Files:** `src/app/invitations/page.tsx`, `src/components/employers/invitation-list.tsx`, `src/components/employers/talent-search.tsx`, `src/components/employers/published-vacancies.tsx`, `src/lib/invitations.ts`, `src/lib/employer-store.ts`

**Estimated scope:** M

## Phase 7: Seal

## Task 11: Overview with the seal

**Description:** `/employers` overview shows the level, every check with its detail and what is needed for the next level.

**Acceptance criteria:**
- [x] The level is never stored; it is computed on every visit
- [x] Unmet checks say what to do, not what went wrong

**Verification:**
- [x] Demo script step 6 checked in Chrome at 375 px and desktop

**Dependencies:** Tasks 5 and 9

**Files:** `src/app/employers/page.tsx`, `src/components/employers/seal-panel.tsx`, `src/lib/seal.ts`, `src/lib/employer-store.ts`

**Estimated scope:** S

## Phase 8: Polish and demo

## Task 12: Privacy, accessibility, critique, demo data and rehearsal

**Description:** Update `/privacy` (vacancy text goes to Groq, and what the employer side keeps). Check every screen at 375 px, keyboard only, with a screen reader and the Reading settings on. Run `/impeccable critique`. Add demo data and an "Employers" row to the README. Rehearse the 5-minute script.

**Acceptance criteria:**
- [x] `/privacy` says what really leaves the device, and Delete my data removes every key, guarded by a test
- [x] Every screen passes at 375 px, by keyboard, with AA contrast and the Reading settings on
- [x] A sample vacancy can be loaded for rehearsals
- [x] The 5-minute script runs end to end with the real AI
- [ ] A real screen reader reads every screen

**Dependencies:** Tasks 6 to 11

**Estimated scope:** M

## Phase 9 (optional): Extension API

## Task 13: Public seal and vacancy endpoints

**Description:** `GET /api/public/seal` and `GET /api/public/vacancies/[id]` with CORS for Regina's extension, returning published data only.

**Not built:** vacancies live in the browser, so a server has nothing to return until there is a database.

**Dependencies:** Tasks 6 and 11, and a database

**Estimated scope:** S
