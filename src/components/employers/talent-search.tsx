"use client";

import { useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { EmployerPage } from "@/components/employers/employer-page";
import { ListDetail, ListRow, ROWS, useOpenRow, useUrlValue } from "@/components/employers/list-detail";
import { Field, SelectField, action, control, note, outlined, panel } from "@/components/employers/vacancy-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addPermission, markAnswerSent, scheduleInterview, useEmployerData, type EmployerData } from "@/lib/employer-store";
import { opensAt, toLocalInput } from "@/lib/interview-questions";
import { Loading } from "@/components/loading";
import { useHydrated } from "@/lib/use-hydrated";
import { STAGE_FORMAT_LABELS, type Vacancy } from "@/lib/vacancy";
import { DEMO_PROFILES, changeText, explainPlace, ordinal, skillsLine, talentRows, type TalentRow } from "@/lib/work-profile";

const ANSWERS: Record<NonNullable<TalentRow["status"]>, string> = {
  invited: "Invited. Waiting for their answer.",
  accepted: "They said yes to this job.",
  declined: "They said no to this job.",
};
const STATES: Record<NonNullable<TalentRow["status"]>, string> = { invited: "Invited", accepted: "Said yes", declined: "Said no" };

// Job posts live in localStorage, so the people wait for hydration; the sky and title don't.
export function TalentSearch() {
  const hydrated = useHydrated();
  return (
    <EmployerPage title="People" intro="We sort people by skills only. What a person needs at work never changes the order.">
      {hydrated ? <Search /> : <Loading />}
    </EmployerPage>
  );
}

function ToJobs({ message }: { message: string }) {
  return (
    <div className={panel}>
      <p>{message}</p>
      <Link href="/employers/vacancies" className={buttonVariants({ variant: "outline", className: `${outlined} w-fit` })}>
        Go to Jobs
      </Link>
    </div>
  );
}

function Search() {
  const data = useEmployerData();
  const { vacancies, permissions } = data;
  const [chosen] = useUrlValue("job");
  const row = useOpenRow("person");
  const published = vacancies.filter((v) => v.status === "published");
  // Next keeps this page alive while the employer is elsewhere, so the chosen job post may have been unpublished since.
  const vacancy = published.find((v) => v.id === chosen) ?? published[0];
  const options = published.map((v) => ({ value: v.id, label: `${v.title} · ${v.company}` }));

  return (
    <>
      {vacancy && (
        <div className="w-full sm:w-[20rem]">
          {/* Changing the job closes the person who was open. */}
          <SelectField label="Job" value={vacancy.id} options={options} onChange={(id) => id && window.history.pushState(null, "", `?job=${encodeURIComponent(id)}`)} />
        </div>
      )}
      <p className={`${note} ${row.open ? "hidden lg:flex" : ""}`}>Names stay hidden until they say yes.</p>
      {!vacancy ? (
        <ToJobs message="Publish a job post to see who fits it." />
      ) : vacancy.essential.some((r) => r.skill) ? (
        <Results vacancy={vacancy} rows={talentRows(vacancy, DEMO_PROFILES, permissions)} data={data} row={row} />
      ) : (
        <ToJobs message="This job post has no skills to match yet. Pick a skill for each essential requirement." />
      )}
    </>
  );
}

function Results({ vacancy, rows, data, row }: { vacancy: Vacancy; rows: TalentRow[]; data: EmployerData; row: ReturnType<typeof useOpenRow> }) {
  const { open, setOpen, title } = row;
  const untagged = vacancy.essential.filter((r) => !r.skill).length;
  const others = DEMO_PROFILES.length - rows.length;
  const selected = rows.find((r) => r.profile.id === open) ?? rows[0];

  return (
    <>
      {untagged > 0 && (
        <p className={note}>
          {untagged === 1 ? "1 essential requirement has" : `${untagged} essential requirements have`} no skill, so {untagged === 1 ? "it doesn't" : "they don't"} count here.
        </p>
      )}
      {selected ? (
        <ListDetail
          open={open !== null}
          backLabel="Back to all people"
          onBack={() => setOpen(null)}
          list={
            <div className="flex flex-col gap-3">
              <ol aria-label="People, best skills match first" className={ROWS}>
                {rows.map((r, i) => (
                  <li key={r.profile.id}>
                    <ListRow id={r.profile.id} selected={r === selected} open={open !== null} onOpen={() => setOpen(r.profile.id)} className="flex-col items-start gap-0">
                      <span>
                        {i + 1}. {r.name ?? r.profile.alias}
                      </span>
                      <span className="font-normal">
                        <span className="sr-only">, </span>
                        {skillsLine(r)}
                      </span>
                      {r.status && (
                        <span className="font-normal">
                          <span className="sr-only">, </span>
                          {STATES[r.status]}
                        </span>
                      )}
                    </ListRow>
                  </li>
                ))}
              </ol>
              {others > 0 && <p>{others === 1 ? "1 other profile doesn't list" : `${others} other profiles don't list`} these skills.</p>}
              <p data-detail="extra">A skill checked by Constela counts more than one a person says they have. A similar tool counts half.</p>
              <p>This is a demo: the people are fictional, and the skill checks are simulated.</p>
            </div>
          }
        >
          <TalentDetail key={`${vacancy.id}:${selected.profile.id}`} row={selected} vacancy={vacancy} data={data} title={title} />
        </ListDetail>
      ) : (
        <p>No profile lists these skills yet.</p>
      )}
    </>
  );
}

function TalentDetail({ row, vacancy, data, title }: { row: TalentRow; vacancy: Vacancy; data: EmployerData; title: RefObject<HTMLHeadingElement | null> }) {
  const { profile, name, status, reasons, notes } = row;
  const place = explainPlace(vacancy, DEMO_PROFILES, profile.id);
  const answer = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  function invite() {
    setFailed(!addPermission({ candidateId: profile.id, vacancyId: vacancy.id, status: "invited", at: new Date().toISOString() }));
    // The button goes once the invitation is saved, so focus rests beside the answer instead of falling back to the page.
    answer.current?.focus();
  }

  return (
    <section aria-labelledby="person-title" className={panel}>
      <div>
        <h2 id="person-title" ref={title} tabIndex={-1} className="text-xl font-semibold outline-none">
          {name ?? profile.alias}
        </h2>
        <p>
          {profile.headline}
          {name && `. ${profile.alias}`}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">Has {skillsLine(row)}</h3>
        <ul aria-label="Why this place in the list" className="list-disc pl-6">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      {place && (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">What would change the order</h3>
          <ul className="list-disc pl-6">
            {place.changes.slice(0, 2).map((change) => (
              <li key={change.skill}>{changeText(change)}</li>
            ))}
            {place.changes.length === 0 && <li>{place.place === 1 ? "They are in 1st place." : `No single skill would move them above ${ordinal(place.place)} place.`}</li>}
            {/* Worked out for this person just now, not promised: the ranking runs again with their needs taken out and with every need added. */}
            {place.sameWithoutNeeds && <li>Sharing what they need at work doesn&apos;t change their place. We check this for each person.</li>}
          </ul>
        </div>
      )}

      {notes.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">What would help this person</h3>
          <ul className="list-disc pl-6">
            {notes.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      )}

      <div ref={answer} tabIndex={-1} className="flex flex-wrap items-center gap-3 outline-none">
        {status === null && (
          <Button className={action} onClick={invite}>
            Invite this person
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
    </section>
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
          className={control}
        />
      </Field>
      {shortNotice && <p>Candidates get the questions 48 hours before. Pick a later time if you can.</p>}
      {booking?.choices.map((choice) => (
        <p key={choice.stage}>
          For “{choice.stage}”, they chose: {STAGE_FORMAT_LABELS[choice.format]}.
        </p>
      ))}
      {response && (
        <div className="flex flex-wrap items-center gap-3">
          {!response.answeredAt && (
            <Button variant="outline" className={outlined} onClick={() => markAnswerSent(candidateId, vacancy.id, new Date())}>
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
