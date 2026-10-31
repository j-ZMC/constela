# Implementation Plan: Constela for Employers

Source: [SPEC-employers.md](../../SPEC-employers.md) (draft). Tasks: [todo.md](todo.md).

## Overview

The four MVP features from the features document, built in phases rather than days: a phase ends when its check passes, and several can close on the same day. Logic first, so every UI phase only renders and calls tested functions.

## Architecture Decisions

- **Rules as pure functions in `src/lib`.** `vacancy.ts`, `work-profile.ts` and `seal.ts` hold every score and privacy rule, with tests. Components never compute a score.
- **AI logic separate from the route**, copying `breakdown.ts`: Zod schemas, the prompt and the call in `src/lib/employer-ai.ts`; the route only validates, picks the model and maps errors. Tests use `MockLanguageModelV4`.
- **One storage module**, `employer-store.ts`, versioned and validated like `src/lib/plan.ts`, so broken JSON never crashes a page.
- **`/employers` shares the header.** `SiteNav` swaps to the employer menu and name there, so the two menus can never show together. `employers/layout.tsx` sets the section's title and description. No route groups: teammates' pages don't move during the sprint.
- **Ranking by essential skills only.** Environment fit is shown, never ranked (SPEC decision 5).

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
- [ ] Task 6: Vacancy editor with live clarity score
- [ ] Task 7: Published vacancies on `/jobs`

### Checkpoint 4
- [ ] Demo script steps 1 to 3 work

### Phase 5: Talent search (feature 2)
- [ ] Task 8: Anonymous ranked profiles, fit and invitations

### Phase 6: Process and interview (feature 3)
- [ ] Task 9: Structured interview, question checker and interviewer guide
- [ ] Task 10: The candidate's invitation view

### Phase 7: Seal (feature 4)
- [ ] Task 11: Overview with the seal

### Phase 8: Polish and demo
- [ ] Task 12: Privacy, accessibility, critique, demo data and rehearsal

### Checkpoint: Complete
- [ ] Every success criterion in SPEC-employers.md is met
- [ ] The 5-minute demo script runs end to end
- [ ] Review with the team

### Phase 9 (optional): Extension API
- [ ] Task 13: Public seal and vacancy endpoints for Regina's extension

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
| Barrier categories leaking to employers | High | Only `needsFromBarriers()` reads barrier ids; tests assert no category comes out |
| Seal thresholds disputed | Low | Constants in one file; the SPEC lists them as proposals |

## Parallel Work

- Phase 2 (server) and Phase 3 (UI shell) don't depend on each other.
- After Phase 3, Luis can review the shared header, and Zahid and Juan can place `<PublishedVacancies />`.

## Open Questions

See [SPEC-employers.md](../../SPEC-employers.md#open-questions).
