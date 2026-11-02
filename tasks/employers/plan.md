# Implementation Plan: Constela for Employers

Source: [SPEC-employers.md](../../SPEC-employers.md) (draft). Tasks: [todo.md](todo.md).

## Overview

The four MVP features from the features document, built in phases rather than days: a phase ends when its check passes, and several can close on the same day. Logic first, so every UI phase only renders and calls tested functions.

## Architecture Decisions

- **Rules as pure functions in `src/lib`.** `vacancy.ts`, `work-profile.ts` and `seal.ts` hold every score and privacy rule, with tests. Components never compute a score.
- **AI logic separate from the route**, copying `breakdown.ts`: Zod schemas, the prompt and the call in `src/lib/employer-ai.ts`; the route only validates, picks the model and maps errors. Tests use `MockLanguageModelV4`.
- **One storage module**, `employer-store.ts`, versioned and validated like `src/lib/plan.ts`, so broken JSON never crashes a page.
- **`/employers` has its own shell.** `SiteNav` shows nothing there and `employers/layout.tsx` renders `EmployerNav`, so the two menus can never show together. No route groups: teammates' pages don't move during the sprint.
- **The employer theme lives on `<html>`** through `data-area`, so it reaches the page and dialogs and a palette from Personalize still wins.
- **Ranking by essential skills only.** Environment fit is shown, never ranked (SPEC decision 5).
- **Pages read stored data through `useEmployerData()`.** Next keeps visited pages alive and hidden, so data read once on mount would go stale. The hook re-reads when a page comes back.

## Task List

### Phase 0: Setup
- [x] App runs locally: dependencies, `.env.local`, embedding caches
- [x] Branch `feature/employers`
- [x] SPEC, plan and todo
- [ ] Shared objects reviewed with the team (30 minutes)

### Phase 1: Shared objects and rules
- [x] Task 1: Vacancy, vocabularies, clarity score and phrase detector
- [x] Task 2: WorkProfile, Permission, needs mapping, fit, ranking and the CV-pair test
- [x] Task 3: Seal levels

### Checkpoint 1
- [x] `npm test`, `npm run lint` and `npx tsc --noEmit` pass
- [x] CV-pair test: B ranks above A in 10 of 10

### Phase 2: AI route
- [x] Task 4: `employer-ai.ts` (extract, rewrite, interview) and `POST /api/employer-ai`

### Checkpoint 2
- [x] Tests with the mock model, lint, types and build pass
- [x] With a real Groq key, all three tasks return good results and extract takes under 15 s (2 to 5 s)

### Phase 3: Employers shell
- [x] Task 5: Layout, menu, hidden candidate menu, intro link and `employer-store.ts`

### Checkpoint 3
- [x] Tests, lint, types and build pass
- [x] Menus, 44 px targets, keyboard and the largest text checked in Chrome at 375 px and desktop
- [ ] A real screen reader reads the menu (the accessibility tree already has the right names)

### Phase 4: Clear vacancy (feature 1)
- [x] Task 6: Vacancy editor with live clarity score
- [x] Task 7: Published vacancies on `/jobs`

### Checkpoint 4
- [x] Tests, lint, types and build pass
- [x] Demo script steps 1 to 3 work in Chrome at 375 px and desktop, with simulated AI answers
- [x] Demo script steps 1 to 3 work with a real Groq key
- [ ] Zahid and Juan agree with the `/jobs` change

### Phase 5: Talent search (feature 2)
- [x] Task 8: Anonymous ranked profiles, fit and invitations

### Checkpoint 5
- [x] Tests, lint, types and build pass
- [x] Demo script step 4 works in Chrome at 375 px and desktop, by keyboard and at the largest text
- [x] A candidate says yes from their own screen (Phase 6)

### Phase 6: Process and interview (feature 3)
- [x] Task 9: Structured interview, question checker and interviewer guide
- [x] Task 10: The candidate's invitation view

### Checkpoint 6
- [x] Tests, lint, types and build pass
- [x] Demo script step 5 works in Chrome at 375 px and desktop, with real AI questions
- [ ] Evy agrees that candidates read the questions on `/invitations`

### Phase 7: Seal (feature 4)
- [x] Task 11: Overview with the seal

### Checkpoint 7
- [x] Tests, lint, types and build pass
- [x] The level follows the data in Chrome at 375 px and desktop, and is never stored

### Phase 8: Polish and demo
- [x] Task 12: Privacy, accessibility, critique, demo data and rehearsal

### Checkpoint: Complete
- [ ] Every success criterion in SPEC-employers.md is met (only the real screen reader is left)
- [x] The 5-minute demo script runs end to end, with the real AI
- [ ] Review with the team

### Redesign: direction B, "Todo en su sitio"
- [x] Three directions proposed on a canvas; the team chose B
- [x] Task R1: Theme, font and side menu
- [x] Task R2: Home and seal page
- [x] Task R3: Jobs as a list of parts, with autosave
- [x] Task R4: People as a list with its detail
- [x] Task R5: Guide as a list of parts
- [x] Task R6: Accessibility, rehearsal and documents

### Checkpoint: Redesign
- [x] Tests, lint, types and build pass
- [x] Candidate pages keep their colors, font, size, menu and buttons
- [x] Every employer screen passes in Chrome at 375 px and desktop, by keyboard, with AA contrast in all five palettes and at the hardest reading settings
- [x] The 5-minute demo script runs end to end, with the real AI
- [ ] Test with 3 to 5 neurodivergent people
- [ ] A real screen reader reads every screen
- [ ] Luis reviews the shared files: `SiteNav`, `DeleteMyData`, `PersonalizationPanel`, root layout and `globals.css`

### Phase 9 (optional): Extension API
- [ ] Task 13: Public seal and vacancy endpoints for Regina's extension. Not built: vacancies live in the browser, so a server has nothing to return until there is a database.

## If time runs short

Cut in this order: Phase 9 → microcourse beyond the guide → AI interview drafts (use a fixed template built from the essential requirements) → AI rewrites (keep the phrase hints only).

Never cut: the rules and their tests, the CV-pair test, the no-diagnosis rule, the anonymous view, accessibility.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| The team changes a shared object after Phase 3 | Med | Review in Phase 0; schemas are `.strict()`, so a mismatch fails loudly in tests |
| The AI maps a requirement to the wrong skill | Med | The employer reviews every tag before saving; untagged requirements are shown but not ranked |
| The AI invents a salary or a duration | High | Numbers must appear in the posting, so an invented one is dropped and the clarity score keeps asking for it |
| The AI invents facts in a rewrite | High | Examples in the prompt; without a [bracket] a rewrite can only take words away; the employer accepts every suggestion |
| Groq free-tier limits during the demo | Med | About 8 rewrites a minute: rehearse with pauses. Typed errors with a manual path; the clarity score and phrase hints work without AI |
| Environment fit read as a candidate's weakness | High | Never ranked; employers see gaps as adjustments they could offer |
| An employer skips someone because of a shared need | High | The order can't change and the page says so; whether needs show before a yes is open question 6 |
| Barrier categories leaking to employers | High | Only `needsFromBarriers()` reads barrier ids; tests assert no category comes out |
| Seal thresholds disputed | Low | Constants in one file; the SPEC lists them as proposals |
| The AI misses a written option in the hiring steps | Low | It happened in 1 of 3 rehearsals. The employer checks Hiring steps before publishing and can pick it by hand |
| A draft nobody wants stays in the Jobs list | Low | Drafts save themselves and there is no delete yet; candidates never see them |

## Parallel Work

- Phase 2 (server) and Phase 3 (UI shell) don't depend on each other.
- Luis can review the shared header, and Zahid and Juan can review `<PublishedVacancies />` on `/jobs`.

## Open Questions

See [SPEC-employers.md](../../SPEC-employers.md#open-questions).
