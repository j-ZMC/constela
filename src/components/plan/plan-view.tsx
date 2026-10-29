"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Constellation } from "@/components/profile/constellation";
import { AddStep } from "@/components/plan/add-step";
import { BreakdownDialog } from "@/components/plan/breakdown-dialog";
import { CheckInReply, EnergyCheckIn } from "@/components/plan/energy-check-in";
import { PathDialog } from "@/components/plan/path-dialog";
import { AllDone, CurrentStep, Duration, ICONS, NextStep, Pause, Removed, Rest, StageDone } from "@/components/plan/step-card";
import { StepDetails } from "@/components/plan/step-details";
import {
  addSteps,
  checkInDue,
  completeStep,
  gentleTone,
  loadPlan,
  localDate,
  removeStep,
  resetCheckIn,
  savePlan,
  setEnergy,
  STAGES,
  stepKey,
  syncWithProfile,
  todayEnergy,
  undoStep,
  visibleSteps,
  type Energy,
  type NewStep,
  type Plan,
  type PlanStep,
  type Stage,
} from "@/lib/plan";
import { STAGE_NAMES, STAGE_STEPS, activeSteps, fillToday, goBack, stageComplete, stageOf, weekGoal } from "@/lib/path";
import { loadProfile, toAdaptations } from "@/lib/profile";
import { useHydrated } from "@/lib/use-hydrated";

// Every change goes through the path: move on if a stage is done, keep a step ready, add a due habit, set the week's goal.
function throughPath(plan: Plan): Plan {
  const now = new Date();
  return weekGoal(fillToday(plan, now), now).plan;
}

// Plan and profile live in localStorage, so render only after hydration (same as the Profile flow).
export function PlanView() {
  return useHydrated() ? <View /> : null;
}

function View() {
  const [profile] = useState(loadProfile);
  const [plan, setPlan] = useState<Plan>(() => {
    const p = throughPath(syncWithProfile(loadPlan(), profile !== null));
    savePlan(p);
    return p;
  });
  // The stage just finished, shown as its own moment before the next stage's first step.
  const [stageDone, setStageDone] = useState<Stage | null>(null);
  const [pathOpen, setPathOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [paused, setPaused] = useState(false);
  const [newTask, setNewTask] = useState("");
  // stepId: break down an existing step (it is replaced); otherwise the typed task is broken down.
  const [request, setRequest] = useState<{ id: string; task: string; stepId?: string } | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  // shortcut: "Stop for today" lasts for this visit only; store it per day in the plan if people ask for it to stick.
  const [resting, setResting] = useState(false);
  // The plan as it was before the last Remove, so one tap can bring the step back.
  const [removed, setRemoved] = useState<{ before: Plan; title: string } | null>(null);
  const adaptations = toAdaptations(profile ?? {});
  const now = new Date();
  const energy = todayEnergy(plan, now);
  const flags = { explicitSteps: adaptations.explicitSteps, summaryMode: adaptations.summaryMode, gentleTone: gentleTone(energy) };

  function update(next: Plan): Plan {
    // A stage whose rule is met by this change; going back to a stage never counts as finishing it.
    const finished = next.stage && stageComplete(next) ? stageOf(next) : null;
    const p = throughPath(next);
    setPlan(p);
    savePlan(p);
    setRemoved(null);
    if (finished && stageOf(p) !== finished) setStageDone(finished);
    return p;
  }

  function remove(step: PlanStep) {
    update(removeStep(plan, step.id));
    setRemoved({ before: plan, title: step.title });
    setAnnouncement("");
  }

  function undoRemove() {
    if (!removed) return;
    update(removed.before);
    setAnnouncement(`Back on your plan: ${removed.title}`);
  }

  const stage = stageOf(plan);
  const active = activeSteps(plan);
  const shown = visibleSteps({ ...plan, steps: active }, adaptations, energy);
  const [current, ...upNext] = shown;
  // importantFirst: only the current step stays on screen; everything else waits behind a count.
  const next = adaptations.importantFirst ? [] : upNext;
  const later = active.filter((s) => !s.done && s !== current && !next.includes(s));
  // The constellation is this stage's round: what is waiting, this stage's stars, and stage-less steps done today.
  // Stars from earlier stages live in "Your path", not here.
  const today = localDate(now);
  const doneToday = (s: PlanStep) => s.doneAt !== undefined && localDate(new Date(s.doneAt)) === today;
  const thisRound = (s: PlanStep) => !plan.stageOpenedAt || (s.doneAt !== undefined && s.doneAt >= plan.stageOpenedAt);
  const stars = active.filter((s) => !s.done || (s.stage === stage ? thisRound(s) : !s.stage && doneToday(s)));
  const done = stars.filter((s) => s.done).length;
  const goal = weekGoal(plan, now);
  const selectedStep = plan.steps.find((s) => s.id === selected);
  const finishedToday = plan.steps.filter((s) => s.done && s.doneAt && localDate(new Date(s.doneAt)) === localDate(now));
  const justDoneTitle = plan.steps.find((s) => s.id === justDone)?.title;
  const breakdownFirst = (step: PlanStep) => adaptations.offerBreakdownFirst && step.minutes > 3;

  function finish(id: string) {
    const updated = update(completeStep(plan, id, new Date()));
    setJustDone(id);
    const upcoming = visibleSteps({ ...updated, steps: activeSteps(updated) }, adaptations, energy)[0];
    if (stageOf(updated) !== stage) {
      setAnnouncement(`You finished ${STAGE_NAMES[stage]}. Next stage: ${STAGE_NAMES[stageOf(updated)]}.`);
      return;
    }
    setAnnouncement(upcoming ? `Step done. Next: ${upcoming.title}` : "Step done. You finished every step.");
    setPaused(adaptations.gentlePacing && upcoming !== undefined);
  }

  function backTo(target: Stage) {
    update(goBack(plan, target, new Date()));
    setPathOpen(false);
    setStageDone(null);
    setAnnouncement(`Back to ${STAGE_NAMES[target]}.`);
  }

  function checkIn(level: Energy | null) {
    update(setEnergy(plan, level, new Date()));
    // The reply takes focus, so the step card must not grab it too.
    setAnnouncement("");
    setCheckedIn(true);
  }

  function addFromDialog(steps: NewStep[], source: PlanStep["source"]) {
    const parent = plan.steps.find((s) => s.id === request?.stepId);
    if (parent) {
      // The small steps take the big step's place and keep its icon, link, stage and kind, so the stage
      // counts the big step as done once the last small one is.
      const inherited = steps.map((s) => ({ ...s, icon: parent.icon, href: parent.href, stage: parent.stage }));
      const added = addSteps(plan, inherited, source, parent.id);
      const kind = stepKey(parent.id);
      const renamed = added.steps.map((s) => (plan.steps.includes(s) ? s : { ...s, id: `${kind}:${s.id}` }));
      update(removeStep({ ...added, steps: renamed }, parent.id));
    } else {
      update(addSteps(plan, steps, source));
      setNewTask("");
    }
    setRequest(null);
    setAnnouncement(`Added ${steps.length} ${steps.length === 1 ? "step" : "steps"}.`);
  }

  function addOne(title: string) {
    update(addSteps(plan, [{ title, minutes: 5 }], "user"));
    setNewTask("");
    setAnnouncement(`Added: ${title}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold">Today</h1>
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <p className="font-medium">
            Stage {STAGES.indexOf(stage) + 1} of {STAGES.length}: {STAGE_NAMES[stage]}
          </p>
          <Button variant="ghost" className="h-11 px-3 text-base underline underline-offset-4" onClick={() => setPathOpen(true)}>
            Your path
          </Button>
        </div>
        <Constellation
          lit={stars.map((s) => s.done)}
          names={stars.map((s) => s.title)}
          label={`${done} of ${stars.length} steps done`}
          onSelect={(i) => setSelected(stars[i].id)}
          glow={stars.findIndex((s) => s.id === justDone && s.done)}
          current={current ? stars.indexOf(current) : undefined}
        />
        <p className="text-muted-foreground">
          {done} of {stars.length} steps done.{" "}
          <span data-detail="extra" className="text-sm">
            Tap a star to see a step.
          </span>
        </p>
        {/* One small goal a week. When it is met it says so; when the week ends unmet, a new week simply brings a new goal. */}
        <p className="flex items-center gap-2">
          {goal.met && <Check className="size-5 shrink-0 text-primary" aria-hidden />}
          <span>
            {goal.text}
            {goal.met && <span className="text-muted-foreground">. Done</span>}
          </span>
        </p>
        {!profile && (
          <p className="text-sm text-muted-foreground">
            These are the standard settings.{" "}
            <Link href="/profile" className="font-medium text-foreground underline underline-offset-4">
              Set up your profile
            </Link>{" "}
            to fit the plan to you.
          </p>
        )}
        {energy && <CheckInReply level={energy} focus={checkedIn} onChange={() => update(resetCheckIn(plan))} />}
        {checkInDue(plan, now) && <EnergyCheckIn onChoose={checkIn} />}
      </header>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {stageDone ? (
        <StageDone
          finished={STAGE_NAMES[stageDone]}
          next={STAGE_NAMES[stage]}
          stars={STAGE_STEPS[stageDone].length}
          onContinue={() => {
            setStageDone(null);
            setAnnouncement(current ? `Next: ${current.title}` : "");
          }}
        />
      ) : resting ? (
        <Rest next={current} onBack={() => setResting(false)} />
      ) : paused && current ? (
        <Pause
          finished={justDoneTitle}
          next={current}
          onContinue={() => setPaused(false)}
          onStop={() => {
            setPaused(false);
            setResting(true);
          }}
        />
      ) : current ? (
        <CurrentStep
          key={current.id}
          step={current}
          focus={announcement !== ""}
          breakdownFirst={breakdownFirst(current)}
          prominentTime={adaptations.showDurations}
          onDone={() => finish(current.id)}
          onBreakdown={() => setRequest({ id: crypto.randomUUID(), task: current.title, stepId: current.id })}
        />
      ) : (
        <AllDone focus={announcement !== ""} today={finishedToday} />
      )}

      {removed && <Removed title={removed.title} onUndo={undoRemove} />}

      {!paused && !resting && !stageDone && next.length > 0 && (
        <section aria-labelledby="up-next" className="flex flex-col gap-3">
          <h2 id="up-next" className="text-sm font-semibold text-muted-foreground">
            Up next
          </h2>
          <ul className="flex flex-col">
            {next.map((s) => (
              <NextStep key={s.id} step={s} />
            ))}
          </ul>
        </section>
      )}

      {!resting && later.length > 0 && (
        <details className="group">
          <summary className="flex h-11 w-fit cursor-pointer items-center rounded-lg px-1 font-medium text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
            {adaptations.importantFirst
              ? `${later.length} more ${later.length === 1 ? "step" : "steps"}, out of the way for now`
              : `See what's next (${later.length})`}
          </summary>
          <ul className="flex flex-col divide-y">
            {later.map((s) => {
              const Icon = ICONS[s.icon];
              return (
              <li key={s.id} className="flex items-center gap-3 py-2 pl-1">
                <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">{s.title}</span>
                <Duration minutes={s.minutes} />
                <Button variant="ghost" className="h-11 px-4" onClick={() => remove(s)} aria-label={`Remove: ${s.title}`}>
                  Remove
                </Button>
              </li>
              );
            })}
          </ul>
        </details>
      )}

      <AddStep
        breakdownFirst={adaptations.offerBreakdownFirst}
        value={newTask}
        onChange={setNewTask}
        onAdd={addOne}
        onBreakdown={(task) => setRequest({ id: crypto.randomUUID(), task })}
      />

      {pathOpen && <PathDialog plan={plan} onBack={backTo} onClose={() => setPathOpen(false)} />}

      {selectedStep && (
        <StepDetails
          step={selectedStep}
          onDone={() => {
            setSelected(null);
            finish(selectedStep.id);
          }}
          onUndo={() => {
            setSelected(null);
            update(undoStep(plan, selectedStep.id));
            setAnnouncement(`Back on your plan: ${selectedStep.title}`);
          }}
          onRemove={() => {
            setSelected(null);
            remove(selectedStep);
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {request && (
        <BreakdownDialog
          key={request.id}
          task={request.task}
          // Starter steps tell the server which fixed app description to give the AI.
          flags={{ ...flags, starter: request.stepId?.startsWith("starter-") ? request.stepId : undefined }}
          onAdd={addFromDialog}
          onClose={() => setRequest(null)}
        />
      )}
    </div>
  );
}
