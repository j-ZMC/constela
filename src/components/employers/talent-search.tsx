"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Field, SelectField, action } from "@/components/employers/vacancy-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addPermission, markAnswerSent, scheduleInterview, useEmployerData, type EmployerData } from "@/lib/employer-store";
import { opensAt, toLocalInput } from "@/lib/interview-questions";
import { useHydrated } from "@/lib/use-hydrated";
import { STAGE_FORMAT_LABELS, type Vacancy } from "@/lib/vacancy";
import { DEMO_PROFILES, talentRows, type TalentRow } from "@/lib/work-profile";

const ANSWERS: Record<NonNullable<TalentRow["status"]>, string> = {
  invited: "Invited. Waiting for their answer.",
  accepted: "They said yes to this vacancy.",
  declined: "They said no to this vacancy.",
};

// Vacancies live in localStorage, so render only after hydration (same as the Profile flow).
export function TalentSearch() {
  return useHydrated() ? <Search /> : null;
}

function ToVacancies({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <p>{message}</p>
      <Link href="/employers/vacancies" className={buttonVariants({ variant: "outline", className: `${action} w-fit` })}>
        Go to your vacancies
      </Link>
    </div>
  );
}

function Search() {
  const data = useEmployerData();
  const { vacancies, permissions } = data;
  const [chosen, setChosen] = useState<string>();
  const published = vacancies.filter((v) => v.status === "published");
  // Next keeps this page alive while the employer is elsewhere, so the chosen vacancy may have been unpublished since.
  const vacancy = published.find((v) => v.id === chosen) ?? published[0];

  if (!vacancy) return <ToVacancies message="Publish a vacancy to see who fits it." />;

  const options = published.map((v) => ({ value: v.id, label: `${v.title} · ${v.company}` }));
  return (
    <div className="flex flex-col gap-6">
      <SelectField label="Vacancy" value={vacancy.id} options={options} onChange={setChosen} />
      {vacancy.essential.some((r) => r.skill) ? (
        <Results vacancy={vacancy} rows={talentRows(vacancy, DEMO_PROFILES, permissions)} data={data} />
      ) : (
        <ToVacancies message="This vacancy has no skills to match yet. Pick a skill for each essential requirement." />
      )}
    </div>
  );
}

function Results({ vacancy, rows, data }: { vacancy: Vacancy; rows: TalentRow[]; data: EmployerData }) {
  const untagged = vacancy.essential.filter((r) => !r.skill).length;
  const others = DEMO_PROFILES.length - rows.length;
  return (
    <>
      {untagged > 0 && (
        <p className="rounded-lg bg-secondary p-3 text-sm">
          {untagged === 1 ? "1 essential requirement has" : `${untagged} essential requirements have`} no skill, so {untagged === 1 ? "it doesn't" : "they don't"} count here.
        </p>
      )}
      {rows.length > 0 ? (
        <ol className="flex flex-col gap-4">
          {rows.map((row, i) => (
            <li key={`${vacancy.id}:${row.profile.id}`}>
              <TalentCard row={row} rank={i + 1} vacancy={vacancy} data={data} />
            </li>
          ))}
        </ol>
      ) : (
        <p>No profile lists these skills yet.</p>
      )}
      {rows.length > 0 && others > 0 && (
        <p className="text-sm text-muted-foreground">
          {others === 1 ? "1 other profile doesn't list" : `${others} other profiles don't list`} these skills.
        </p>
      )}
    </>
  );
}

function TalentCard({ row, rank, vacancy, data }: { row: TalentRow; rank: number; vacancy: Vacancy; data: EmployerData }) {
  const { profile, name, status, score, reasons, notes } = row;
  const place = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  function invite() {
    setFailed(!addPermission({ candidateId: profile.id, vacancyId: vacancy.id, status: "invited", at: new Date().toISOString() }));
    // The button goes once the invitation is saved, so focus rests beside the answer instead of falling back to the page.
    place.current?.focus();
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {profile.headline}
            {name && ` · ${profile.alias}`}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {rank}. {name ?? profile.alias}
          </h2>
        </div>
        <p className="rounded-md bg-secondary px-3 py-1 text-sm">Skills match: {score} of 100</p>
      </div>

      <ul aria-label="Why this place in the ranking" className="list-inside list-disc text-sm">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      {notes.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-secondary p-3 text-sm">
          <h3 className="font-semibold">What would help this person</h3>
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}

      <div ref={place} tabIndex={-1} className="flex flex-wrap items-center gap-3 outline-none">
        {status === null && (
          <Button className={action} aria-label={`Invite ${profile.alias}`} onClick={invite}>
            Invite
          </Button>
        )}
        {/* Stays in the page, so screen readers announce the answer when it arrives. */}
        <p role="status">{failed ? "This browser could not save the invitation. Try again." : status && ANSWERS[status]}</p>
        {/* shortcut: one browser holds both sides for the demo; with accounts the candidate gets this page in their own session. */}
        {status === "invited" && (
          <Link href="/invitations" className="flex min-h-11 items-center underline underline-offset-4">
            See what the candidate sees
          </Link>
        )}
      </div>

      {status === "accepted" && <AfterYes candidateId={profile.id} vacancy={vacancy} data={data} />}
    </article>
  );
}

// What the employer does once a person says yes: set the time, see what they chose, and send the answer they promised.
function AfterYes({ candidateId, vacancy, data }: { candidateId: string; vacancy: Vacancy; data: EmployerData }) {
  const pair = (x: { candidateId?: string; vacancyId?: string }) => x.candidateId === candidateId && x.vacancyId === vacancy.id;
  const booking = data.bookings.find(pair);
  const response = data.responses.find(pair);
  const interviewAt = booking?.interviewAt;
  const shortNotice = interviewAt !== undefined && opensAt(interviewAt) < new Date(data.permissions.findLast(pair)?.at ?? 0);

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <Field label="Interview date and time">
        <Input
          type="datetime-local"
          value={interviewAt ? toLocalInput(interviewAt) : ""}
          onChange={(e) => scheduleInterview(candidateId, vacancy.id, e.target.value ? new Date(e.target.value).toISOString() : undefined)}
          className="h-11 bg-card text-base font-normal md:text-base"
        />
      </Field>
      {shortNotice && <p className="text-sm">Candidates get the questions 48 hours before. Pick a later time if you can.</p>}
      {booking?.choices.map((choice) => (
        <p key={choice.stage} className="text-sm">
          For “{choice.stage}”, they chose: {STAGE_FORMAT_LABELS[choice.format]}.
        </p>
      ))}
      {response && (
        <div className="flex flex-wrap items-center gap-3">
          {!response.answeredAt && (
            <Button variant="outline" className={action} onClick={() => markAnswerSent(candidateId, vacancy.id, new Date())}>
              I sent my answer
            </Button>
          )}
          <p role="status">
            {response.answeredAt
              ? `You answered on ${new Date(response.answeredAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
              : `Your answer is due by ${new Date(response.dueAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`}
          </p>
        </div>
      )}
    </div>
  );
}
