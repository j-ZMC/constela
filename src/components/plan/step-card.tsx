"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clock,
  ListChecks,
  MessagesSquare,
  Star,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Constellation } from "@/components/profile/constellation";
import { completesItself, type PlanStep, type StepIcon } from "@/lib/plan";
import { cn } from "@/lib/utils";

export const ICONS: Record<StepIcon, LucideIcon> = {
  user: UserRound,
  briefcase: BriefcaseBusiness,
  bookmark: Bookmark,
  building: Building2,
  message: MessagesSquare,
  calendar: CalendarDays,
  list: ListChecks,
};

const action = "h-11 px-5 text-base";

const DESTINATIONS: Record<string, string> = { "/profile": "Profile", "/jobs": "Jobs", "/interview": "Interview" };

// "Open Jobs", not a bare "Open": says where the link goes, also for screen readers.
export function openLabel(href: string) {
  const name = DESTINATIONS[href];
  return name ? `Open ${name}` : "Open";
}

// The one thing to do now: icon, verb-first title, duration, and its actions.
export function CurrentStep({
  step,
  focus,
  breakdownFirst,
  prominentTime,
  onDone,
  onBreakdown,
}: {
  step: PlanStep;
  focus: boolean;
  breakdownFirst: boolean;
  prominentTime: boolean;
  onDone: () => void;
  onBreakdown: () => void;
}) {
  const Icon = ICONS[step.icon];
  const selfDone = completesItself(step.id);
  const heading = useRef<HTMLHeadingElement>(null);
  // After Done, the button is gone; land keyboard and screen-reader users on the new step.
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);
  return (
    // The one weighted surface on the page: everything else stays flat so this reads as "do this now".
    <article
      aria-labelledby={`step-${step.id}`}
      className="flex flex-col gap-5 rounded-2xl border border-primary/15 bg-card p-5 shadow-[0_10px_30px_-14px_rgb(36_59_83/0.35)] sm:p-7"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={`step-${step.id}`} ref={heading} tabIndex={-1} className="text-2xl font-semibold text-balance outline-none">
            {step.title}
          </h2>
          <Duration
            minutes={step.minutes}
            className={prominentTime ? "w-fit rounded-md bg-secondary px-2 py-1 text-base font-medium text-foreground" : undefined}
          />
        </div>
      </div>
      {selfDone ? (
        <p className="text-muted-foreground">This step is done by itself when you finish your profile.</p>
      ) : (
        breakdownFirst && (
          <p data-detail="extra" className="text-muted-foreground">
            This is a big step. You can break it down first.
          </p>
        )
      )}
      {/* Same order on every step: go do it, mark it done, or make it smaller. */}
      <div className="flex flex-wrap gap-3">
        {step.href && (
          <Link href={step.href} className={buttonVariants({ className: action })}>
            {openLabel(step.href)}
          </Link>
        )}
        {!selfDone && (
          <Button variant={step.href ? "outline" : "default"} className={action} onClick={onDone}>
            Done
          </Button>
        )}
        {!selfDone && (
          <Button variant={breakdownFirst ? "outline" : "ghost"} className={action} onClick={onBreakdown}>
            Break it down for me
          </Button>
        )}
      </div>
    </article>
  );
}

// The end of the path: today's finished steps as lit stars on one line, so the person sees what they did.
export function AllDone({ focus, today }: { focus: boolean; today: PlanStep[] }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);
  const minutes = today.reduce((sum, s) => sum + s.minutes, 0);
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-primary/15 bg-card p-5 shadow-[0_10px_30px_-14px_rgb(36_59_83/0.35)] sm:p-7">
      <div className="flex flex-col gap-2">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {today.length > 0 ? "Done for today" : "Every step is done"}
        </h2>
        <p className="text-pretty text-muted-foreground">
          You finished every step on your path. Take a rest. When you are ready, add a new step.
        </p>
      </div>
      {today.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="font-medium">
            Today: {today.length} {today.length === 1 ? "step" : "steps"}, about {minutes} minutes
          </p>
          <ol aria-label="Steps you finished today" className="flex flex-col">
            {today.map((s, i) => (
              <li key={s.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
                {/* The line that joins this star to the next one. */}
                {i < today.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-0.5 bg-star/60" />}
                <Star className="relative size-6 shrink-0 fill-star text-star" aria-hidden />
                <span className="pt-0.5">{s.title}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

// gentlePacing: a pause after each step instead of jumping straight to the next one.
export function Pause({
  finished,
  next,
  onContinue,
  onStop,
}: {
  finished?: string;
  next: PlanStep;
  onContinue: () => void;
  onStop: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-card p-5 shadow-[0_10px_30px_-14px_rgb(36_59_83/0.35)] sm:p-7">
      <div className="flex flex-col gap-2">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          Nice work
        </h2>
        {finished && <p>You finished: {finished}.</p>}
        <p className="text-pretty text-muted-foreground">
          Next is {next.title} ({next.minutes} min). Take a break if you need one.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button className={action} onClick={onContinue}>
          Keep going
        </Button>
        {/* Stopping is a real choice, not a failure: as visible as going on. */}
        <Button variant="outline" className={action} onClick={onStop}>
          Stop for today
        </Button>
      </div>
    </section>
  );
}

// The end of a stage: its constellation fully lit, then the next stage in one tap.
export function StageDone({ finished, next, stars, onContinue }: { finished: string; next: string; stars: number; onContinue: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-card p-5 shadow-[0_10px_30px_-14px_rgb(36_59_83/0.35)] sm:p-7">
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
        You finished {finished}
      </h2>
      <Constellation lit={Array(stars).fill(true)} label={`${finished}: every star is lit`} glow={stars - 1} />
      <p className="text-pretty text-muted-foreground">Next stage: {next}. Its first step is ready when you are.</p>
      <Button className={`${action} w-fit`} onClick={onContinue}>
        See my next step
      </Button>
    </section>
  );
}

export function Rest({ next, onBack }: { next?: PlanStep; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-card p-5 shadow-[0_10px_30px_-14px_rgb(36_59_83/0.35)] sm:p-7">
      <div className="flex flex-col gap-2">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          Rest well
        </h2>
        <p className="text-pretty text-muted-foreground">
          You did enough for today.{next ? ` Your next step is waiting: ${next.title}.` : ""}
        </p>
      </div>
      <Button variant="outline" className={`${action} w-fit`} onClick={onBack}>
        Show my plan
      </Button>
    </section>
  );
}

export function NextStep({ step }: { step: PlanStep }) {
  const Icon = ICONS[step.icon];
  return (
    <li className="flex items-center gap-3 border-b px-1 py-3 last:border-b-0">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1">{step.title}</span>
      <Duration minutes={step.minutes} />
    </li>
  );
}

// Shown after Remove until the next change, so a stray tap is never final. No timer: it waits for the person.
export function Removed({ title, onUndo }: { title: string; onUndo: () => void }) {
  const undo = useRef<HTMLButtonElement>(null);
  // The removed row is gone; keep keyboard and screen-reader users next to the way back.
  useEffect(() => undo.current?.focus(), [title]);
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 rounded-lg bg-secondary px-4 py-1">
      <p className="flex-1">Removed: {title}</p>
      <Button ref={undo} variant="ghost" className="h-11 px-4 text-base" onClick={onUndo}>
        Undo
      </Button>
    </div>
  );
}

export function Duration({ minutes, className }: { minutes: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1 text-sm whitespace-nowrap text-muted-foreground", className)}>
      <Clock className="size-3.5" aria-hidden />
      {minutes} min
    </span>
  );
}
