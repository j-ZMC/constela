"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { SelectField, action } from "@/components/employers/vacancy-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { addPermission, useEmployerData } from "@/lib/employer-store";
import { useHydrated } from "@/lib/use-hydrated";
import type { Vacancy } from "@/lib/vacancy";
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
  const { vacancies, permissions } = useEmployerData();
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
        <Results vacancy={vacancy} rows={talentRows(vacancy, DEMO_PROFILES, permissions)} />
      ) : (
        <ToVacancies message="This vacancy has no skills to match yet. Pick a skill for each essential requirement." />
      )}
    </div>
  );
}

function Results({ vacancy, rows }: { vacancy: Vacancy; rows: TalentRow[] }) {
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
              <TalentCard row={row} rank={i + 1} vacancy={vacancy} />
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

function TalentCard({ row, rank, vacancy }: { row: TalentRow; rank: number; vacancy: Vacancy }) {
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
      </div>
    </article>
  );
}
