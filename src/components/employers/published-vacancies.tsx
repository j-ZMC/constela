"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronRight } from "lucide-react";
import { CARD, MASONRY } from "@/components/paged-grid";
import { loadBarrierPreferences } from "@/lib/barrier-preferences";
import { useEmployerData, useSeal } from "@/lib/employer-store";
import { waitingInvitations } from "@/lib/invitations";
import { SEAL_NAMES, type SealLevel } from "@/lib/seal";
import { ENVIRONMENT, MODALITY_LABELS, STAGE_FORMAT_LABELS, factorNames, salaryText, type EnvironmentFactor, type Stage, type Vacancy } from "@/lib/vacancy";
import { DEMO_PROFILES, compatibility, fitSummary, needsFromBarriers } from "@/lib/work-profile";

const noUpdates = () => () => {};

// What the employer published, for candidates on /jobs. Nothing shows until there is something published.
export function PublishedVacancies() {
  const data = useEmployerData();
  // shortcut: one browser holds one employer, so every vacancy shares a seal; give each company its own with accounts.
  const { level } = useSeal(data);
  // Re-read each time Jobs comes back: Next keeps this page alive, and the person may have changed their survey meanwhile.
  const barriers = useSyncExternalStore(noUpdates, () => (loadBarrierPreferences() ?? []).join(","), () => "");
  const published = data.vacancies.filter((v) => v.status === "published");
  if (published.length === 0) return null;

  // Read on the candidate's own device: the needs stay here and never reach the employer.
  const needs = needsFromBarriers(barriers ? barriers.split(",") : []);
  const waiting = waitingInvitations(data, DEMO_PROFILES);

  return (
    <section data-tour="jobs-clear" aria-labelledby="clear-vacancies-heading" className="flex flex-col gap-3">
      {waiting > 0 && (
        <Link href="/invitations" className="flex min-h-11 items-center rounded-lg bg-secondary px-3 font-medium underline underline-offset-4">
          You have {waiting === 1 ? "1 invitation" : `${waiting} invitations`}. See {waiting === 1 ? "it" : "them"}.
        </Link>
      )}
      <div>
        <h2 id="clear-vacancies-heading" className="text-xl font-semibold">
          Vacancies written for clarity
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">These employers say what the work is, what it pays and every step of hiring.</p>
      </div>
      <ul className={MASONRY}>
        {published.map((v) => (
          <li key={v.id} className={CARD}>
            <VacancyCard vacancy={v} level={level} needs={needs} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Details({ title, items }: { title: string; items: ReactNode[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h4 className="font-semibold">{title}</h4>
      <ul className="list-inside list-disc">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function stepText(s: Stage): string {
  const parts = [s.name, STAGE_FORMAT_LABELS[s.format]];
  if (s.minutes) parts.push(`${s.minutes} minutes`);
  if (s.who) parts.push(`with ${s.who}`);
  if (s.alternative) parts.push(`or choose: ${STAGE_FORMAT_LABELS[s.alternative].toLowerCase()}`);
  return parts.join(" · ");
}

function VacancyCard({ vacancy: v, level, needs }: { vacancy: Vacancy; level: SealLevel | null; needs: EnvironmentFactor[] }) {
  const fit = compatibility(v, { needs, modalities: [] });
  const summary = fitSummary(fit);

  return (
    <article className="flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">{v.company}</p>
          {level && (
            <span
              title="Based on how this employer writes vacancies and treats candidates on Constela."
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20"
            >
              <BadgeCheck aria-hidden className="size-3.5" />
              Neuroinclusive seal: {SEAL_NAMES[level]}
            </span>
          )}
          {level && (
            <Link
              href={`/seal-check?company=${encodeURIComponent(v.company)}`}
              aria-label={`Check this seal: ${v.company}`}
              className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
            >
              Check this seal
            </Link>
          )}
        </div>
        <h3 className="mt-1 text-lg font-semibold leading-snug">{v.title}</h3>
      </div>

      <ul aria-label="Job details" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {v.location && <li>{v.location}</li>}
        {v.modality && <li>Work mode: {MODALITY_LABELS[v.modality]}</li>}
        {v.salary && <li>{salaryText(v.salary)}</li>}
        {v.schedule && <li>{v.schedule}</li>}
      </ul>

      {v.summary && <p className="text-sm leading-relaxed">{v.summary}</p>}

      {summary && (
        <div className="flex flex-col gap-1 rounded-lg bg-secondary p-3 text-sm">
          <p className="font-semibold">{summary}</p>
          {fit.met.length > 0 && <p>It offers: {factorNames(fit.met)}.</p>}
          {fit.gaps.length > 0 && <p>Not listed: {factorNames(fit.gaps)}. You can ask about these.</p>}
        </div>
      )}

      <details className="group">
        <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm font-medium">
          <ChevronRight aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-90" />
          See the tasks and hiring steps
        </summary>
        <div className="mt-2 flex flex-col gap-4 text-sm leading-relaxed">
          <Details title="A typical day" items={v.tasks} />
          <Details title="Essential" items={v.essential.map((r) => r.text)} />
          <Details title="Nice to have" items={v.niceToHave.map((r) => r.text)} />
          <Details title="Work environment" items={(v.environment ?? []).map((f) => ENVIRONMENT[f])} />
          <Details title="Adjustments you can have" items={v.accommodations} />
          <Details title="Hiring steps" items={v.process.map(stepText)} />
          {v.responseDays && (
            <p>
              You get an answer within {v.responseDays} {v.responseDays === 1 ? "day" : "days"} after each step.
            </p>
          )}
        </div>
      </details>
    </article>
  );
}
