# Implementation Plan: Job search path

Source: [SPEC-path.md](../../SPEC-path.md) (approved). Tasks: [todo.md](todo.md).

## Overview

My plan stops ending after 6 fixed steps. The plan gets a current stage (Get ready, Look for jobs, Apply, Prepare for the interview, Follow up). Each stage has its own short step list; when a stage is done the next one opens, and Follow up loops back to Look for jobs. Steps from other modules and two light habits join in, and one small weekly goal sits under the constellation.

## Decisions on the spec's open questions (defaults, change any of them)

1. **Stages and copy:** as written in the spec; Kairos reviews the copy before release.
2. **Jobs events:** Jobs calls `addStepToPlan({ ..., stage })` for follow-up steps and `markEvent("job-saved" | "application-sent")` for "done when" rules.
3. **Interview:** the person presses Done; Interview may also call `markEvent("practice-done")`.
4. **Weekly goal:** the app picks it from the current stage.
5. **AI "Suggest my next step":** after testing with Kairos users, not in this iteration.

## Architecture Decisions

- **Stage logic in a new `src/lib/path.ts`**: stage list, each stage's steps and "done when" rule, `stageOf`, `advance`, `goBack`, `fillToday`, `weekGoal`. `plan.ts` keeps storage and the pure step functions; components only render.
- **No version bump.** New fields are optional; an old plan loads as stage "Get ready" and its starter steps get their stage from a fixed id map, so nobody loses steps or stars.
- **Stage steps are added to the plan when the stage opens**, as normal steps with `stage`. That keeps Done, Undo, the constellation, Break it down and the check-in working unchanged.
- **"Done when" rules read the plan only** (step ids and `events`), so they stay pure and testable. Events are a small list stored in the plan: `{ type, at }`.
- **Habits** are added at most once per due day and never counted; an undone habit is replaced, not stacked.
- **Constellation shows the current stage's steps.** "Your path" is a dialog listing the five stages with their own small constellations.

## Task List

### Phase 1: Model and rules
- [ ] Task 1: Stages, stage steps, migration of old plans and stage progression (with tests)
- [ ] Task 2: Today's steps: fill from the stage, module steps first, habits, carry-over (with tests)
- [ ] Task 3: Weekly goal (with tests)

### Checkpoint A
- [ ] Tests, lint, types and build pass; an old saved plan loads with no lost steps

### Phase 2: Screen and modules
- [ ] Task 4: My plan header: stage name, weekly goal, current stage constellation, stage-complete moment, "Your path" and going back
- [ ] Task 5: Module hook: `addStepToPlan` with `stage`, `markEvent`, short guide for Zahid and Evy

### Checkpoint: Complete
- [ ] Every success criterion in SPEC-path.md is met
- [ ] Manual check: a simulated week (change the date) at 375 px and desktop, keyboard only
- [ ] Review with the team

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Old plans break or lose steps | High | Optional fields only, id-to-stage map, a test that loads a plan saved by today's app |
| Too many steps pile up | High | Hard cap: today's list never exceeds what `visibleSteps` shows; habits replace, never stack |
| Jobs and Interview aren't ready to send events | Med | Stages also complete through the person's own Done; events are an extra path |
| Date edge cases (new day, new week) | Med | All date logic takes `now` as a parameter and is tested with fixed dates |
| Copy that feels childish or pushy | Med | Easy Read rules, no streaks or guilt copy, Kairos review |

## Parallel Work

- Task 5's guide can go to Zahid and Evy as soon as Task 1 fixes the stage names.
