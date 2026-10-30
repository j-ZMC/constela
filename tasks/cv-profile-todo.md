# Tasks: CV profile and recommended jobs

Plan: [cv-profile-plan.md](cv-profile-plan.md) · Specs: [SPEC-resume-parsing.md](../SPEC-resume-parsing.md), [CAPABILITY-MAP-cv-profile.md](../CAPABILITY-MAP-cv-profile.md)

## Phase 1: Resume parsing boundary

- [ ] Task 1: Validate the existing parser and define the ResumeProfile contract
  - Acceptance: the agreed JSON shape is typed and parser output is normalized without PII leakage into recommendations.
  - Verify: focused Python and Vitest tests.
  - Files: `backend/resume_parser.py/`, `src/lib/resume.ts`, tests.
  - Dependencies: None.

- [ ] Task 2: Add the PDF upload API and temporary-file cleanup
  - Acceptance: valid PDFs parse; invalid/oversized files return generic errors; temp files are removed.
  - Verify: route tests, Python tests, TypeScript check.
  - Files: `src/app/api/resume/parse/route.ts`, route tests, backend adapter if needed.
  - Dependencies: Task 1.

## Checkpoint: Parser boundary

- [ ] Parser/API tests pass
- [ ] No OpenAI call occurs during CV parsing

## Phase 2: Profile hub

- [ ] Task 3: Add local profile storage and Account/Questionnaire/CV sections
  - Acceptance: Profile exposes the three sections, preserves questionnaire behavior, and stores local account/CV JSON with versioning.
  - Verify: Vitest, lint, TypeScript, browser reload check.
  - Files: `src/app/profile/page.tsx`, profile components, local storage helpers.
  - Dependencies: Task 2.

- [ ] Task 4: Connect CV upload, parsed JSON preview, retry, and clear actions
  - Acceptance: user can upload, see parsed fields, retry failure, clear the saved CV, and never sees raw parser traces.
  - Verify: browser upload flow at mobile and desktop widths.
  - Files: profile CV component and tests.
  - Dependencies: Task 3.

## Phase 3: Recommendations

- [ ] Task 5: Add the recommendation payload builder from CV + questionnaire
  - Acceptance: payload uses skills/sectors/experience/projects and excludes name/email/phone; text is capped and validated.
  - Verify: unit tests for PII exclusion and empty-profile defaults.
  - Files: `src/lib/recommendations.ts`, tests, API contract updates if needed.
  - Dependencies: Task 3.

- [ ] Task 6: Add the Recommended route and result states
  - Acceptance: Recommended calls the existing jobs API, shows loading/error/empty/results, and keeps Jobs free search unchanged.
  - Verify: frontend tests, build, browser smoke test.
  - Files: `src/app/recommended/page.tsx`, recommendation components.
  - Dependencies: Task 5.

## Phase 4: Navigation and finish

- [ ] Task 7: Add the Recommended navigation entry
  - Acceptance: fifth tab appears in mobile bottom navigation and desktop navigation with correct active state and accessible label.
  - Verify: browser checks at 320, 768, and 1440 widths.
  - Files: `src/components/site-nav.tsx`, tests if needed.
  - Dependencies: Task 6.

- [ ] Task 8: Complete end-to-end verification and documentation
  - Acceptance: all automated checks pass and setup/limitations are documented.
  - Verify: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, Python tests.
  - Files: README/spec updates as needed.
  - Dependencies: Tasks 1–7.
