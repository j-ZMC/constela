"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddStep } from "@/components/plan/add-step";
import { PlanMap } from "@/components/plan/plan-map";
import { AskConstela } from "@/components/plan/ask-constela";
import { BreakdownDialog } from "@/components/plan/breakdown-dialog";
import { EasierToday } from "@/components/plan/energy-check-in";
import { PathDialog } from "@/components/plan/path-dialog";
import { Tour, tourSeen, type TourStep } from "@/components/tour";
import { firstSentence } from "@/components/summary";
import { AllDone, CurrentStep, Duration, ICONS, NextStep, Pause, Removed, Rest, StageDone } from "@/components/plan/step-card";
import { StepDetails } from "@/components/plan/step-details";
import {
  addSteps,
  completeStep,
  gentleTone,
  loadPlan,
  localDate,
  removeStep,
  resetCheckIn,
  savePlan,
  setEnergy,
  BRANCHES,
  stepKey,
  syncWithProfile,
  todayEnergy,
  undoStep,
  visibleSteps,
  type NewStep,
  type Plan,
  type PlanStep,
  type Branch,
} from "@/lib/plan";
import { BRANCH_PREVIEW, BRANCH_STEPS, activeSteps, branchComplete, branchName, currentBranch, fillToday, weekGoal } from "@/lib/path";
import { branchesIn, pathMap } from "@/lib/path-map";
import { loadProfile, toAdaptations } from "@/lib/profile";
import { useHydrated } from "@/lib/use-hydrated";
import { Loading } from "@/components/loading";
import { PageSky, onSky } from "@/components/page-sky";

// The first-visit tour of My plan, one part at a time. Parts not on screen right now are skipped.
const PLAN_TOUR: TourStep[] = [
  { target: "step", title: "Your step for now", text: "Do one thing at a time. When you finish, press Done. If it feels big, press Break it down for me." },
  { target: "stars", title: "Your map", text: "You are the star in the middle. Each branch is a part of the job search, and each star is a step. Done steps light up. Tap a star to see that step." },
  { target: "ask", title: "Hey Constela", text: "Have a question about your plan? Press Hey Constela and ask. You can also turn on listening and say Hey Constela out loud." },
  { target: "path", title: "All branches", text: "Work on the branches in any order. See them all here, and choose which one to work on next." },
];

// Every change goes through the path: add the branches' steps, light steps for what happened, add a due habit, set the week's goal.
function throughPath(plan: Plan): Plan {
  const now = new Date();
  return weekGoal(fillToday(plan, now), now).plan;
}

// Plan and profile live in localStorage, so render only after hydration (same as the Profile flow).
export function PlanView() {
  return useHydrated() ? (
    <View />
  ) : (
    <>
      <PageSky>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Today</h1>
      </PageSky>
      <div className="mx-auto w-full max-w-xl px-4 py-8">
        <Loading />
      </div>
    </>
  );
}

function View() {
  const [profile] = useState(loadProfile);
  const [plan, setPlan] = useState<Plan>(() => {
    const p = throughPath(syncWithProfile(loadPlan(), profile !== null));
    savePlan(p);
    return p;
  });
  // The branch just finished, shown as its own moment before the next step.
  const [stageDone, setStageDone] = useState<Branch | null>(null);
  // The map Hey Constela shows itself on, and the branches its answer names.
  const stage = useRef<HTMLDivElement>(null);
  const [talkedAbout, setTalkedAbout] = useState<Array<Branch | "own">>([]);
  const [pathOpen, setPathOpen] = useState(false);
  // Shown once on the first visit; "How this works" brings it back anytime.
  const [touring, setTouring] = useState(() => !tourSeen("plan"));
  const [announcement, setAnnouncement] = useState("");
  const [paused, setPaused] = useState(false);
  const [newTask, setNewTask] = useState("");
  // stepId: break down an existing step (it is replaced); otherwise the typed task is broken down.
  const [request, setRequest] = useState<{ id: string; task: string; stepId?: string } | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  // The plan as it was before the last Remove, so one tap can bring the step back.
  const [removed, setRemoved] = useState<{ before: Plan; title: string } | null>(null);
  const adaptations = toAdaptations(profile ?? {});
  const now = new Date();
  const energy = todayEnergy(plan, now);
  const flags = { explicitSteps: adaptations.explicitSteps, summaryMode: adaptations.summaryMode, gentleTone: gentleTone(energy) };

  function update(next: Plan): Plan {
    const p = throughPath(next);
    // A branch this change finished: every one of its steps done now, and not before.
    const finished = BRANCHES.find((b) => !branchComplete(plan, b) && branchComplete(p, b)) ?? null;
    setPlan(p);
    savePlan(p);
    setRemoved(null);
    if (finished) setStageDone(finished);
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

  const working = currentBranch(plan);
  const active = activeSteps(plan);
  const shown = visibleSteps({ ...plan, steps: active }, adaptations, energy);
  const [current, ...upNext] = shown;
  // importantFirst: only the current step stays on screen; everything else waits behind a count.
  const next = adaptations.importantFirst ? [] : upNext;
  const later = active.filter((s) => !s.done && s !== current && !next.includes(s));
  // Every branch on one sky; the count is every star on it.
  const map = pathMap(plan);
  const stars = map.flatMap((b) => b.nodes);
  const done = stars.filter((s) => s.done).length;
  const goal = weekGoal(plan, now);
  // "Stop for today" is saved with the date, so a reload keeps the rest screen; the next day starts fresh.
  const resting = plan.restingOn === localDate(now);
  const setResting = (on: boolean) => update({ ...plan, restingOn: on ? localDate(new Date()) : undefined });
  // summaryMode keeps branch descriptions to their first sentence.
  const preview = (b: Branch) => (adaptations.summaryMode ? firstSentence(BRANCH_PREVIEW[b]) : BRANCH_PREVIEW[b]);
  // headsUpOnChanges: when finishing the current step would finish its branch, say so before it happens.
  const ownBranch = current?.stage;
  const finishesBranch = current !== undefined && ownBranch !== undefined && branchComplete(completeStep(plan, current.id, now), ownBranch);
  const headsUp = adaptations.headsUpOnChanges && finishesBranch && ownBranch ? `After this step, ${branchName(ownBranch)} is complete.` : undefined;
  const selectedStep = plan.steps.find((s) => s.id === selected);
  const finishedToday = plan.steps.filter((s) => s.done && s.doneAt && localDate(new Date(s.doneAt)) === localDate(now));
  const justDoneTitle = plan.steps.find((s) => s.id === justDone)?.title;
  // Only steps long enough to have parts get "break it down" as the main action.
  const breakdownFirst = (step: PlanStep) => adaptations.offerBreakdownFirst && step.minutes > 8;

  function finish(id: string) {
    const updated = update(completeStep(plan, id, new Date()));
    setJustDone(id);
    const upcoming = visibleSteps({ ...updated, steps: activeSteps(updated) }, adaptations, energy)[0];
    if (BRANCHES.some((b) => !branchComplete(plan, b) && branchComplete(updated, b))) {
      // The branch card's heading takes focus and says it; the live region stays quiet so it is not heard twice.
      setAnnouncement("");
      return;
    }
    setAnnouncement(upcoming ? `Step done. Next: ${upcoming.title}` : "Step done. You finished every step.");
    setPaused(adaptations.gentlePacing && upcoming !== undefined);
  }

  // From All branches: work on this branch next, or let Constela choose again.
  function choose(branch: Branch | "own" | undefined) {
    update({ ...plan, focus: branch });
    setPathOpen(false);
    setStageDone(null);
    setAnnouncement(branch ? `Working on ${branchName(branch)} now.` : "Constela chooses your next step again.");
  }

  // "Need an easier step today?" is stored as a low-energy day for today only; tomorrow starts as usual.
  function easierToday(on: boolean) {
    update(on ? setEnergy(plan, "low", new Date()) : resetCheckIn(plan));
    // The button keeps focus, so the step card must not grab it too.
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
    <>
      {/* My plan is one sky: the title, the constellation as big as the screen allows, and today's step floating on it,
          beside the map on wide screens and under it on phones. Pressing Done lights its star in view. */}
      <section aria-labelledby="plan-title" className="relative isolate flex flex-col overflow-hidden bg-sky text-white lg:min-h-[calc(100svh-5rem)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 pt-6 sm:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <h1 id="plan-title" className="text-3xl font-bold tracking-tight sm:text-4xl">Today</h1>
            <div className="flex items-center">
              <Button variant="ghost" className={`h-11 px-3 text-base ${onSky}`} onClick={() => setTouring(true)} aria-label="How this works">
                <CircleHelp aria-hidden className="size-5" />
                <span className="max-sm:hidden">How this works</span>
              </Button>
              <Button data-tour="path" variant="ghost" className={`h-11 px-3 text-base underline underline-offset-4 ${onSky}`} onClick={() => setPathOpen(true)}>
                All branches
              </Button>
            </div>
          </div>
          <p className="font-medium text-white/80">{working ? `Working on: ${branchName(working)}` : "Every step is done"}</p>
        </div>

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-6 px-4 pt-2 pb-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[minmax(0,1fr)_auto]">
          {/* As tall as a phone's screen between its bars; on wide screens, all the height the sky has. */}
          <div className="flex min-h-0 flex-col items-center gap-2 max-lg:h-[calc(100svh-15rem)] max-lg:min-h-[24rem] lg:row-span-2">
            <div ref={stage} data-tour="stars" data-voice="idle" className="flex min-h-0 w-full flex-1 items-center justify-center [container-type:size]">
              <PlanMap branches={map} currentId={current?.id} glowId={justDone ?? undefined} highlight={talkedAbout} onSelect={setSelected} />
            </div>
            {/* One small goal a week: when it is met it says so; when the week ends unmet, a new week brings a new goal. */}
            <div className="flex flex-col gap-0.5 text-center">
              <p className="text-white/80">
                {done} of {stars.length} steps done.{" "}
                <span data-detail="extra" className="text-sm max-sm:hidden">
                  Tap a star to see a step.
                </span>
              </p>
              <p className="flex items-center justify-center gap-2">
                {goal.met && <Check className="size-5 shrink-0 text-star" aria-hidden />}
                <span>
                  {goal.text}
                  {goal.met && <span className="text-white/70"> (done)</span>}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 text-foreground max-lg:order-last lg:self-end">
            {stageDone ? (
              <StageDone
                finished={branchName(stageDone)}
                next={working ? branchName(working) : "every step is done"}
                preview={working && working !== "own" ? preview(working) : ""}
                listen={adaptations.listenButton}
                stars={BRANCH_STEPS[stageDone].length}
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
                listen={adaptations.listenButton}
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
                listen={adaptations.listenButton}
                headsUp={headsUp}
                footer={<EasierToday on={gentleTone(energy)} focus={checkedIn} onChange={easierToday} />}
                onDone={() => finish(current.id)}
                onBreakdown={() => setRequest({ id: crypto.randomUUID(), task: current.title, stepId: current.id })}
              />
            ) : (
              <AllDone focus={announcement !== ""} today={finishedToday} />
            )}
            {removed && <Removed title={removed.title} onUndo={undoRemove} />}
          </div>

          <div className="flex justify-center lg:col-start-2">
            <AskConstela plan={plan} stage={stage} onAnswer={(text) => setTalkedAbout(branchesIn(text, map))} />
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10">
      {!profile && (
        <p className="text-sm text-muted-foreground">
          These are the standard settings.{" "}
          <Link href="/profile" className="font-medium text-foreground underline underline-offset-4">
            Set up your profile
          </Link>{" "}
          to fit the plan to you.
        </p>
      )}

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

      {/* A finished stage and the rest screen are quiet moments: no lists, no "add more". */}
      {!resting && !stageDone && later.length > 0 && (
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

      {!resting && !stageDone && (
      <AddStep
        breakdownFirst={adaptations.offerBreakdownFirst}
        value={newTask}
        onChange={setNewTask}
        onAdd={addOne}
        onBreakdown={(task) => setRequest({ id: crypto.randomUUID(), task })}
      />
      )}

      {touring && <Tour name="plan" steps={PLAN_TOUR} onClose={() => setTouring(false)} />}
      {/* Room under the last parts, so the tour can bring them above its panel. */}
      {touring && <div aria-hidden className="h-[50vh]" />}

      {pathOpen && <PathDialog plan={plan} onChoose={choose} onClose={() => setPathOpen(false)} />}

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
          listen={adaptations.listenButton}
          onAdd={addFromDialog}
          onClose={() => setRequest(null)}
        />
      )}
      </div>
    </>
  );
}
