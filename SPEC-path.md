# Spec: Job search path (daily plans by stage)

Status: approved by Luis; defaults for the open questions in [tasks/path/plan.md](tasks/path/plan.md) · Owner: Luis · Builds on [SPEC-plan.md](SPEC-plan.md)

## Objective

Today My plan has one fixed starter path of 6 steps. When those are done, nothing new comes. This spec turns My plan into a guide for the whole job search: every day it offers 1 to 3 real next steps, taken from the stage the person is in, from what they do in the other modules, and from a few light habits.

**User:** the same neurodivergent young adult as the Profile and My plan.

**Success looks like:** a person opens My plan on any day of their job search and sees a clear next step that moves them closer to a job, never an empty screen and never a wall of tasks.

### User stories

- As a user, I can see which stage of my job search I am in and what the next stage is.
- As a user, each day I get 1 to 3 steps that fit my stage, my profile and how I feel today.
- As a user, when I finish a stage, its constellation completes and the next stage opens.
- As a user, when I save a job in Jobs or practice in Interview, the follow-up step appears in My plan by itself.
- As a user, I get one small goal for the week instead of goals every day.
- As a teammate, my module can add a step to the right stage with one function.

## The stages

| # | Stage (UI copy) | Done when | Example steps |
| --- | --- | --- | --- |
| 1 | Get ready | Profile finished and one "what I want" step done | Finish your profile · Choose 3 things you want in a job (remote, quiet, part time) · Update your resume |
| 2 | Look for jobs | One job saved | Look at 3 jobs picked for you · Save one job you like |
| 3 | Apply | One application sent | Read "Get to know the company" for that job · Write 2 questions to ask them · Send your application |
| 4 | Prepare for the interview | One practice session and "What to expect" read | Practice one interview question · Read "What to expect" · Plan how to get there |
| 5 | Follow up | The person marks a reply or chooses to start again | Write a short thank-you message · Wait 5 days, then check your email · Go back to Look for jobs |

- The person can always go back to an earlier stage, for example after a "no" from an employer. Going back never erases stars already earned.
- Stage 5 loops to stage 2: applying is a cycle, not a line.
- Step copy follows Easy Read like the rest of My plan. Kairos reviews it before release.

## Where daily steps come from

1. **The current stage's step list** (fixed, written by us, in `src/lib/path.ts`).
2. **Module events**: Jobs and Interview call `addStepToPlan()` with a stage, for example "Read the job at Acme" when a job is saved.
3. **Light habits**: at most two, for example "Look at new jobs" twice a week in stages 2 to 5. Never daily, never counted as a streak.
4. **Steps the person adds** by hand or with "Break it down", as today.

### Picking today's steps

- Same rules as today: `stepsAtOnce` from the profile (1 or 3), Low energy shows one short step, Stressed the shortest ready step, prerequisites respected.
- Order: module-event steps first (they are the most concrete), then the stage's next step, then a habit if one is due.
- Undone steps carry over to the next day silently. Nothing becomes "overdue" and nothing turns red.
- After "Stop for today", the next visit on the same day shows the rest screen; the next day starts fresh.

## Weekly goal

- One small goal per week, picked from the stage, for example "This week: save 1 job" or "This week: send 1 application".
- Shown as a single line under the constellation, with the stars as progress. No percentages, no streaks.
- If the week ends without it, the next week simply offers a goal again. No "you missed it" message.

## Interface changes

- Header: the stage name above the constellation ("Stage 2 of 5: Look for jobs") and the weekly goal line.
- The constellation shows the current stage's steps. A small "Your path" link opens all five stages as five small constellations, done ones fully lit.
- Finishing a stage: the stage's constellation lights fully (the one authored moment, off with Reduce motion), then "Next: Apply" with one button.
- Everything else in My plan stays as it is.

## Data model

```ts
type Stage = "ready" | "search" | "apply" | "interview" | "follow-up";

type PlanStep = {
  // ...existing fields
  stage?: Stage;          // missing on old steps: treated as the stage they were created in
  from?: "path" | "module" | "habit" | "user" | "ai";
};

type Plan = {
  version: 1;             // fields are optional, so old saved plans load unchanged
  steps: PlanStep[];
  stage?: Stage;          // missing means "ready"
  weekGoal?: { stage: Stage; text: string; week: string };   // week = YYYY-Www
  // ...existing energy, checkInSkipped
};
```

`addStepToPlan(step)` gains an optional `stage`. Stored and validated like today.

## AI (optional, later)

"Suggest my next step": sends only the titles of the last 5 done steps and the stage name, never profile answers or feelings, and returns 1 to 3 step suggestions the person reviews before adding. Same route style and privacy test as "Break it down".

## Boundaries

- **Always:** keep 1 to 3 steps a day at most; respect the profile and the check-in; let the person go back a stage; review copy with Kairos.
- **Ask first:** adding a stage; changing what is sent to the AI; anything that stores data on a server.
- **Never:** streaks, "overdue", red, guilt copy ("You missed…"); more than 3 steps shown at once; inferring progress or feelings from what the person writes.

## Success criteria

- [ ] On any day of a test week, My plan shows 1 to 3 steps from the right stage; never an empty screen while a stage is open.
- [ ] Finishing a stage opens the next one; going back keeps earned stars.
- [ ] A job saved in Jobs adds its follow-up step to My plan.
- [ ] Old saved plans load without losing steps.
- [ ] Tests cover stage progression, daily picking, carry-over and the weekly goal.

## Open questions for the team

1. Are the five stages and their "done when" rules right? Kairos should confirm the copy.
2. How does Jobs tell us a job was saved or an application sent (Zahid)? Proposal: Jobs calls `addStepToPlan()` and a new `markEvent("job-saved")`.
3. Does Interview (Evy) mark "practice done" by itself, or does the person press Done?
4. Weekly goal: chosen by the app, or picked by the person from 2 options?
5. Do we want the AI "Suggest my next step" in this iteration, or after testing with Kairos users?
