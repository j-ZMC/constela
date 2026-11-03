"use client";

import { useRef, useState } from "react";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NO_FILTERS, countWith, filtersOn, loadFilters, matches, saveFilters, type JobFilters } from "@/lib/job-filters";
import type { Job, JobSearchResponse } from "@/lib/jobs";

const PAGE_SIZE = 10;
const key = (job: JobSearchResponse["jobs"][number]) => job.url ?? `${job.company}:${job.similarity_rank}`;

const CHOICES: { [K in Exclude<keyof JobFilters, "verified">]: { label: string; options: [JobFilters[K], string][] } } = {
  mode: { label: "Work mode", options: [["any", "Any"], ["remote", "Remote"], ["hybrid", "Hybrid"], ["on_site", "On-site"]] },
  pay: {
    label: "Pay (a year)",
    options: [
      ["any", "Any"], ["listed", "Shows pay"], ["0-50000", "Under $50,000"], ["50000-80000", "$50,000 to $80,000"],
      ["80000-120000", "$80,000 to $120,000"], ["120000-160000", "$120,000 to $160,000"], ["160000-", "Over $160,000"],
    ],
  },
  size: { label: "Company size", options: [["any", "Any"], ["small", "Small (under 50 people)"], ["medium", "Medium (50 to 999)"], ["large", "Large (1,000 or more)"]] },
};

function Filters({ value, onChange, jobs }: { value: JobFilters; onChange: (next: JobFilters) => void; jobs: Job[] }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <legend className="sr-only">Filter these jobs</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(CHOICES) as (keyof typeof CHOICES)[]).map((name) => (
          <label key={name} className="flex flex-col gap-1 text-sm font-medium">
            {CHOICES[name].label}
            <select
              value={value[name]}
              onChange={(event) => onChange({ ...value, [name]: event.target.value })}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CHOICES[name].options.map(([v, text]) => {
                const count = countWith(jobs, value, name, v);
                // A choice with no jobs stays visible, so the person sees it exists, but cannot be picked.
                return <option key={v} value={v} disabled={count === 0 && v !== value[name]}>{`${text} (${count})`}</option>;
              })}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <Checkbox checked={value.verified} onCheckedChange={(checked) => onChange({ ...value, verified: checked === true })} />
          Only companies with inclusion data
        </label>
        {filtersOn(value) && (
          <Button type="button" variant="ghost" className="h-11 px-4 text-base" onClick={() => onChange(NO_FILTERS)}>Clear filters</Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        The number after each choice is how many jobs it shows. Pay uses the middle of the job&apos;s range; hourly and
        monthly pay count as a full-time year. Work mode also counts jobs whose text suggests it (&quot;Probably remote&quot;).
        Company size comes from B Corp, Y Combinator, the posting itself or an AI estimate.
      </p>
    </fieldset>
  );
}

// One way to show jobs, for Jobs and Internships: filters, a grid of short cards, ten per page,
// and the jobs to review folded away below. Give it a new key for new results, so it starts on page 1.
// filterList: which saved set of filters this list uses ("jobs" or "internships").
export function JobResults({ results, emptyText, label, filterList }: { results: JobSearchResponse; emptyText: string; label: string; filterList: string }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<JobFilters>(() => loadFilters(filterList));
  const top = useRef<HTMLUListElement>(null);
  const jobs = results.jobs.filter((job) => matches(job, filters));
  const review = results.blockedJobs.filter((job) => matches(job, filters));
  const filtered = filtersOn(filters);
  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const visible = jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function go(next: number) {
    setPage(next);
    // The new page starts where the old one did, not at the buttons below it.
    top.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="flex flex-col gap-6">
      <Filters value={filters} jobs={results.jobs} onChange={(next) => { setFilters(next); saveFilters(filterList, next); setPage(1); }} />
      {filtered && (
        <p role="status" className="text-sm text-muted-foreground">
          Showing {jobs.length} of {results.jobs.length} with these filters{review.length ? `, and ${review.length} to review` : ""}.
        </p>
      )}
      {visible.length ? (
        <ul ref={top} aria-label={label} className="divide-y overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(36_59_83/0.05),0_8px_24px_-12px_rgb(36_59_83/0.12)]">
          {visible.map((job) => <li key={key(job)}><JobCard job={job} compact /></li>)}
        </ul>
      ) : (
        <p role="status" className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          {filtered && results.jobs.length
            ? "No jobs match these filters. Try fewer filters."
            : review.length ? "No other jobs were found. You can look at the jobs to review below." : emptyText}
        </p>
      )}
      {totalPages > 1 && (
        <nav aria-label={`${label}, pages`} className="flex items-center justify-center gap-3">
          <Button type="button" variant="outline" className="h-11 px-4 text-base" disabled={page === 1} onClick={() => go(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button type="button" variant="outline" className="h-11 px-4 text-base" disabled={page === totalPages} onClick={() => go(page + 1)}>Next</Button>
        </nav>
      )}
      {review.length > 0 && (
        <details className="rounded-xl border bg-card p-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
            {review.length} {review.length === 1 ? "job" : "jobs"} to review
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">These jobs may include a condition you chose. Read the posting and decide what works for you.</p>
          <ul className="mt-4 divide-y rounded-xl border bg-background/60">
            {review.map((job) => <li key={key(job)}><JobCard job={job} flagged compact /></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
