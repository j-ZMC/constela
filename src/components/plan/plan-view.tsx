"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Constellation } from "@/components/profile/constellation";
import { AddStep } from "@/components/plan/add-step";
import { BreakdownDialog } from "@/components/plan/breakdown-dialog";
import { CheckInReply, EnergyCheckIn } from "@/components/plan/energy-check-in";
import { AllDone, CurrentStep, Duration, ICONS, NextStep, Pause, Removed, Rest } from "@/components/plan/step-card";
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
  syncWithProfile,
  todayEnergy,
  undoStep,
  visibleSteps,
  type Energy,
  type NewStep,
  type Plan,
  type PlanStep,
} from "@/lib/plan";
import { loadProfile, toAdaptations } from "@/lib/profile";
import { useHydrated } from "@/lib/use-hydrated";

// Plan and profile live in localStorage, so render only after hydration (same as the Profile flow).
export function PlanView() {
  return useHydrated() ? <View /> : null;
}

function View() {
  const [profile] = useState(loadProfile);
  const [plan, setPlan] = useState<Plan>(() => syncWithProfile(loadPlan(), profile !== null));
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

  function update(next: Plan) {
    setPlan(next);
    savePlan(next);
    setRemoved(null);
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

  const shown = visibleSteps(plan, adaptations, energy);
  const [current, ...upNext] = shown;
  // importantFirst: only the current step stays on screen; everything else waits behind a count.
  const next = adaptations.importantFirst ? [] : upNext;
  const later = plan.steps.filter((s) => !s.done && s !== current && !next.includes(s));
  const done = plan.steps.filter((s) => s.done).length;
  const selectedStep = plan.steps.find((s) => s.id === selected);
  const finishedToday = plan.steps.filter((s) => s.done && s.doneAt && localDate(new Date(s.doneAt)) === localDate(now));
  const justDoneTitle = plan.steps.find((s) => s.id === justDone)?.title;
  const breakdownFirst = (step: PlanStep) => adaptations.offerBreakdownFirst && step.minutes > 3;

  function finish(id: string) {
    const updated = completeStep(plan, id, new Date());
    update(updated);
    setJustDone(id);
    const upcoming = visibleSteps(updated, adaptations, energy)[0];
    setAnnouncement(upcoming ? `Step done. Next: ${upcoming.title}` : "Step done. You finished every step.");
    setPaused(adaptations.gentlePacing && upcoming !== undefined);
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
      // The small steps take the big step's place and keep its icon and link.
      const inherited = steps.map((s) => ({ ...s, icon: parent.icon, href: parent.href }));
      update(removeStep(addSteps(plan, inherited, source, parent.id), parent.id));
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
        <Constellation
          lit={plan.steps.map((s) => s.done)}
          names={plan.steps.map((s) => s.title)}
          label={`${done} of ${plan.steps.length} steps done`}
          onSelect={(i) => setSelected(plan.steps[i].id)}
          glow={plan.steps.findIndex((s) => s.id === justDone && s.done)}
          current={current ? plan.steps.indexOf(current) : undefined}
        />
        <p className="text-muted-foreground">
          {done} of {plan.steps.length} steps done.{" "}
          <span data-detail="extra" className="text-sm">
            Tap a star to see a step.
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

      {resting ? (
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

      {!paused && !resting && next.length > 0 && (
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
