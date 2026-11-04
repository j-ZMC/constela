"use client";

import { useRef, useState } from "react";
import { JobCard } from "@/components/jobs/job-card";
import { CARD, FilterGroup, FiltersToggle, MASONRY, MASONRY_WIDE, Pager, SIDEBAR, pageCount, pageOf, sidebarLayout } from "@/components/paged-grid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NO_FILTERS, countWith, filtersOn, loadFilters, matches, saveFilters, type JobFilters } from "@/lib/job-filters";
import type { JobSearchResponse } from "@/lib/jobs";

// Twelve fill two or three columns evenly.
const PAGE_SIZE = 12;
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
  size: { label: "Company size", options: [["any", "Any"], ["small", "Small (under 50)"], ["medium", "Medium (50 to 999)"], ["large", "Large (1,000 or more)"]] },
};
const NAMES = Object.keys(CHOICES) as (keyof typeof CHOICES)[];

// One way to show jobs, for Jobs and Internships: filters beside the results, separate cards like a pinboard, twelve
// per page, and the jobs to review folded away below. Give it a new key for new results, so it starts on page 1.
// filterList: which saved set of filters this list uses ("jobs" or "internships").
export function JobResults({ results, emptyText, label, filterList }: { results: JobSearchResponse; emptyText: string; label: string; filterList: string }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<JobFilters>(() => loadFilters(filterList));
  const [showFilters, setShowFilters] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const jobs = results.jobs.filter((job) => matches(job, filters));
  const review = results.blockedJobs.filter((job) => matches(job, filters));
  const filtered = filtersOn(filters);
  const chosen = NAMES.filter((n) => filters[n] !== "any").length + (filters.verified ? 1 : 0);
  const totalPages = pageCount(jobs.length, PAGE_SIZE);
  const visible = pageOf(jobs, page, PAGE_SIZE);

  function change(next: JobFilters) {
    setFilters(next);
    saveFilters(filterList, next);
    setPage(1);
  }

  function go(next: number) {
    setPage(next);
    // The new page starts where the old one did, not at the buttons below it.
    top.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div className={sidebarLayout(showFilters)}>
      {showFilters && (
      <aside aria-label="Filters" className={SIDEBAR}>
        {NAMES.map((name) => (
          <FilterGroup
            key={name}
            id={`${filterList}-${name}`}
            label={CHOICES[name].label}
            value={filters[name] as string}
            options={(CHOICES[name].options as [string, string][]).map(([v, text]) => [v, text, countWith(results.jobs, filters, name, v as never)])}
            onChange={(v) => change({ ...filters, [name]: v })}
          />
        ))}
        <label className="flex min-h-11 items-center gap-2 px-3 text-sm font-medium">
          <Checkbox checked={filters.verified} onCheckedChange={(checked) => change({ ...filters, verified: checked === true })} />
          Only companies with inclusion data
        </label>
        {filtered && <Button type="button" variant="outline" onClick={() => change(NO_FILTERS)}>Clear filters</Button>}
      </aside>
      )}

      <div ref={top} className="flex min-w-0 scroll-mt-24 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            {jobs.length} {jobs.length === 1 ? "result" : "results"}
            {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
            {review.length > 0 && ` · ${review.length} to review`}
          </p>
          <FiltersToggle open={showFilters} chosen={chosen} onToggle={() => setShowFilters(!showFilters)} />
        </div>
        {visible.length ? (
          <ul aria-label={label} className={showFilters ? MASONRY : MASONRY_WIDE}>
            {visible.map((job) => <li key={key(job)} className={CARD}><JobCard job={job} compact /></li>)}
          </ul>
        ) : (
          <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            {filtered && results.jobs.length ? "No jobs match these filters. Try fewer filters." : review.length ? "Look at the jobs to review below." : emptyText}
          </p>
        )}
        <Pager page={page} pages={totalPages} onPage={go} label={label} />
        {review.length > 0 && (
          <details className="rounded-xl border bg-card p-4">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
              {review.length} {review.length === 1 ? "job" : "jobs"} to review
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">They may include a condition you chose.</p>
            <ul className={`mt-4 ${showFilters ? MASONRY : MASONRY_WIDE}`}>
              {review.map((job) => <li key={key(job)} className={CARD}><JobCard job={job} flagged compact /></li>)}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
