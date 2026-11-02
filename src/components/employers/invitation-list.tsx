"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { answerInvitation, chooseFormat, useEmployerData, type StageChoice } from "@/lib/employer-store";
import { opensAt, questionsOpen } from "@/lib/interview-questions";
import { addInterviewStep, listInvitations, type Invitation } from "@/lib/invitations";
import { useHydrated } from "@/lib/use-hydrated";
import { STAGE_FORMAT_LABELS, type Stage } from "@/lib/vacancy";
import { DEMO_PROFILES } from "@/lib/work-profile";

// 44px at least, and taller when the text is: at the largest settings a long label wraps instead of leaving the screen.
const action = "h-auto min-h-11 max-w-full shrink whitespace-normal px-5 py-2 text-base";

const when = (iso: string | Date) => new Date(iso).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

export function InvitationList() {
  return useHydrated() ? <List /> : null;
}

function List() {
  const data = useEmployerData();
  const invitations = listInvitations(data, DEMO_PROFILES);
  if (invitations.length === 0) return <p className="text-muted-foreground">You have no invitations yet. When an employer invites you, it shows here.</p>;
  return (
    <ul className="flex flex-col gap-6">
      {invitations.map((invitation) => (
        <li key={`${invitation.candidateId}:${invitation.vacancy.id}`}>
          <InvitationCard invitation={invitation} />
        </li>
      ))}
    </ul>
  );
}

function InvitationCard({ invitation }: { invitation: Invitation }) {
  const { candidateId, alias, vacancy, status } = invitation;
  const place = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  function answer(next: "accepted" | "declined") {
    const saved = answerInvitation(candidateId, vacancy, next, new Date());
    setFailed(!saved);
    if (saved && next === "accepted") addInterviewStep(vacancy.company);
    // The buttons change with the answer, so focus rests beside them instead of falling back to the page.
    place.current?.focus();
  }

  // The names start with the words on the button, so voice control can find it by what it says.
  const yesWords = status === "declined" ? "Say yes after all" : "Say yes";
  const noWords = status === "accepted" ? "Say no after all" : "Say no";
  const yes = (
    <Button variant="outline" className={action} aria-label={`${yesWords}: ${vacancy.title}, ${alias}`} onClick={() => answer("accepted")}>
      {yesWords}
    </Button>
  );
  const no = (
    <Button variant="outline" className={action} aria-label={`${noWords}: ${vacancy.title}, ${alias}`} onClick={() => answer("declined")}>
      {noWords}
    </Button>
  );

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {vacancy.company} · for {alias}
        </p>
        <h2 className="mt-1 text-xl font-semibold">{vacancy.title}</h2>
      </div>

      <div ref={place} tabIndex={-1} className="flex flex-col gap-3 outline-none">
        <p role="status">
          {failed && "This browser could not save your answer. Try again."}
          {!failed && status === "invited" && `${vacancy.company} found you by your skills. They can't see your name unless you say yes.`}
          {!failed && status === "accepted" && `You said yes. ${vacancy.company} can see your name for this job.`}
          {!failed && status === "declined" && `You said no. ${vacancy.company} can't see your name.`}
        </p>
        {/* Both answers look the same and take one press: saying no is as easy as saying yes. */}
        <div className="flex flex-wrap gap-3">
          {status !== "accepted" && yes}
          {status !== "declined" && no}
        </div>
      </div>

      {status !== "declined" && <Tracker invitation={invitation} />}
      {status === "accepted" && <Questions invitation={invitation} />}
    </article>
  );
}

function Tracker({ invitation }: { invitation: Invitation }) {
  const { vacancy, status } = invitation;
  return (
    <section className="flex flex-col gap-2" aria-label="Hiring steps">
      <h3 className="font-semibold">What happens next</h3>
      <ol className="flex flex-col gap-3">
        {vacancy.process.map((step, i) => (
          <li key={step.name} className="flex flex-col gap-1 rounded-lg bg-secondary p-3 text-sm">
            <p className="font-semibold">
              Step {i + 1}: {step.name}
            </p>
            <p>
              {STAGE_FORMAT_LABELS[step.format]} · {step.minutes ? `${step.minutes} minutes` : "The time will be confirmed"}
              {step.who && ` · with ${step.who}`}
            </p>
            {vacancy.responseDays && (
              <p>
                You get an answer within {vacancy.responseDays} {vacancy.responseDays === 1 ? "day" : "days"} after this step.
              </p>
            )}
            {status === "accepted" && step.alternative && <FormatChoice invitation={invitation} step={step} alternative={step.alternative} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

function FormatChoice({ invitation, step, alternative }: { invitation: Invitation; step: Stage; alternative: StageChoice["format"] }) {
  const { candidateId, vacancy, booking } = invitation;
  const chosen = booking?.choices.find((c) => c.stage === step.name)?.format;
  const options = [
    { value: "planned", label: STAGE_FORMAT_LABELS[step.format] },
    { value: alternative, label: STAGE_FORMAT_LABELS[alternative] },
  ];
  return (
    <div className="flex flex-col gap-1 pt-1">
      <p id={`format-${step.name}`} className="font-medium">
        Choose how you do this step
      </p>
      <RadioGroup aria-labelledby={`format-${step.name}`} value={chosen ?? "planned"} onValueChange={(v) => chooseFormat(candidateId, vacancy.id, step.name, v === "planned" ? undefined : alternative)}>
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3">
            <RadioGroupItem value={o.value} />
            {o.label}
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function Questions({ invitation }: { invitation: Invitation }) {
  const { vacancy, booking, questions } = invitation;
  const interviewAt = booking?.interviewAt;

  if (!interviewAt) return <p className="rounded-lg bg-secondary p-3 text-sm">{vacancy.company} will set the date. You can read the questions 48 hours before.</p>;

  const heading = <p className="rounded-lg bg-secondary p-3 text-sm">Your interview is on {when(interviewAt)}.</p>;
  if (!questionsOpen(interviewAt, new Date())) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <p className="text-sm">You can read the questions from {when(opensAt(interviewAt))}.</p>
      </div>
    );
  }
  if (questions.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <p className="text-sm">{vacancy.company} is still preparing the questions.</p>
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-2" aria-label="Your interview questions">
      {heading}
      <h3 className="font-semibold">Your interview questions</h3>
      <p className="text-sm text-muted-foreground">Everyone gets the same questions. You can bring notes.</p>
      <ol className="flex list-decimal flex-col gap-3 pl-6">
        {questions.map((q) => (
          <li key={q.requirement}>
            <p>{q.question}</p>
            <p className="text-sm text-muted-foreground">What they look for: {q.strong}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
