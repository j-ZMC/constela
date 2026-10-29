# Tasks: Job search path

Plan: [plan.md](plan.md) · Spec: [SPEC-path.md](../../SPEC-path.md)

## Phase 1: Model and rules

## Task 1: Stages, stage steps, migration and progression

**Description:** Create `src/lib/path.ts` with the five stages, each stage's step list and "done when" rule, and `stageOf(plan)`, `advance(plan, now)`, `goBack(plan, stage)`. Add optional `stage` and `events` to `Plan`, optional `stage` to `PlanStep`, and validate them in `loadPlan()`. Old plans load as "Get ready" with starter steps mapped to their stage by id.

**Acceptance criteria:**
- [ ] A plan saved by today's app loads unchanged, with every starter step given a stage
- [ ] When a stage's rule is met, `advance` opens the next stage and adds its steps once
- [ ] Follow up loops to Look for jobs; going back never removes done steps

**Verification:**
- [ ] Tests pass: `npm test`; types pass: `npx tsc --noEmit`

**Dependencies:** None

**Files likely touched:** `src/lib/path.ts`, `src/lib/path.test.ts`, `src/lib/plan.ts`, `src/lib/plan.test.ts`

**Estimated scope:** M

## Task 2: Today's steps

**Description:** `fillToday(plan, now)` makes sure the current stage has a next step ready, puts module-event steps first, and adds a due habit ("Look at new jobs", twice a week in stages 2 to 5) at most once, replacing an undone one. Undone steps carry over silently. `visibleSteps` keeps its rules (stepsAtOnce, energy, prerequisites).

**Acceptance criteria:**
- [ ] On any day while a stage is open, at least one step is shown
- [ ] Habits never stack and never appear on non-due days
- [ ] Module-event steps come before stage steps

**Verification:**
- [ ] Tests with fixed dates across a week

**Dependencies:** Task 1

**Files likely touched:** `src/lib/path.ts`, `src/lib/path.test.ts`

**Estimated scope:** M

## Task 3: Weekly goal

**Description:** `weekGoal(plan, now)` picks one small goal from the current stage for the ISO week (YYYY-Www), stores it in the plan, and reports progress from the plan's steps and events. A new week gets a new goal with no "missed" state.

**Acceptance criteria:**
- [ ] One goal per week, from the current stage
- [ ] Progress counts only that week

**Verification:**
- [ ] Tests across a week boundary

**Dependencies:** Task 1

**Files likely touched:** `src/lib/path.ts`, `src/lib/path.test.ts`

**Estimated scope:** S

## Checkpoint A
- [ ] `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` pass
- [ ] An old saved plan loads with no lost steps

## Phase 2: Screen and modules

## Task 4: My plan header and "Your path"

**Description:** Show "Stage N of 5: Name" above the constellation, the weekly goal line under it, and only the current stage's steps in the constellation. When a stage completes, its constellation lights fully (Reduce motion respected), then "Next: <stage>" with one button. "Your path" opens a dialog with the five stages as small constellations and lets the person go back a stage.

**Acceptance criteria:**
- [ ] The header always names the stage and next step; no empty screen while a stage is open
- [ ] Stage complete and going back work by keyboard and screen reader (focus and announcements)
- [ ] 44 px targets; no red, streaks or guilt copy

**Verification:**
- [ ] Manual check at 375 px and desktop, keyboard only, with Reduce motion on

**Dependencies:** Tasks 1 to 3

**Files likely touched:** `src/components/plan/plan-view.tsx`, `src/components/plan/path-dialog.tsx`, `src/components/plan/step-card.tsx`

**Estimated scope:** M

## Task 5: Module hook and guide

**Description:** `addStepToPlan(step)` accepts an optional `stage`; add `markEvent(type)` for "job-saved", "application-sent" and "practice-done". Add a short section to the README for Zahid and Evy with examples.

**Acceptance criteria:**
- [ ] A step added with a stage shows in that stage; an event can complete a stage
- [ ] Invalid stages or events are ignored safely

**Verification:**
- [ ] Tests for both functions

**Dependencies:** Task 1

**Files likely touched:** `src/lib/plan.ts`, `src/lib/path.ts`, `README.md`

**Estimated scope:** S

## Checkpoint: Complete
- [ ] Every success criterion in SPEC-path.md is met
- [ ] Simulated week (change the date) at 375 px and desktop, keyboard only
- [ ] Review with the team
