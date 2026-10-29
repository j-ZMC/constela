"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { JobCard } from "@/components/jobs/job-card";
import { loadBarrierPreferences } from "@/lib/barrier-preferences";
import { JobSearchError, searchJobs, type JobSearchResponse } from "@/lib/jobs";

export function JobSearch() {
  return <SearchForm />;
}

function SearchForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JobSearchResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const userBlockers = loadBarrierPreferences() ?? [];
      setResults(await searchJobs({ query, userBlockers }));
    } catch (cause) {
      setError(cause instanceof JobSearchError ? cause.message : "Could not reach the jobs service. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 flex flex-col gap-6" aria-labelledby="job-search-heading">
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 id="job-search-heading" className="text-xl font-semibold">Search current openings</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Search by role, skill, or work arrangement. Your search phrase is sent to OpenAI to find relevant jobs; your profile selections are not.
        </p>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Job title, skill, or search phrase</span>
            <input
              type="search"
              required
              maxLength={200}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="For example, remote data analyst"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button type="submit" disabled={loading || !query.trim()} className="h-11 px-5 text-base">
            {loading ? "Searching…" : "Find jobs"}
          </Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          Saved profile conditions are used when you search and are not sent to OpenAI.{" "}
          <Link href="/profile" className="font-medium underline underline-offset-4">Update profile</Link>
        </p>
      </div>

      {loading && (
        <div role="status" aria-busy="true" className="flex flex-col gap-3" aria-label="Searching jobs">
          <p className="text-sm text-muted-foreground">Searching the pre-vectorized job index. Only this query is embedded.</p>
          {[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl border bg-card" />)}
        </div>
      )}

      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-card p-4 text-sm">{error}</p>}

      {results && (
        <div className="flex flex-col gap-6" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            {results.summary.visibleMatches} {results.summary.visibleMatches === 1 ? "match" : "matches"} · {results.summary.blockedMatches} flagged for review · {results.summary.jobsExcludedByCompany} excluded by current company data
          </p>
          {results.summary.modalityFilterApplied && (
            <p role="status" className="text-sm text-muted-foreground">
              Work-mode filter: {results.summary.requestedModalities.map((mode) => mode === "on_site" ? "on-site" : mode).join(", ")}. {results.summary.modalityExcludedMatches} similar jobs excluded by the mode filter.
            </p>
          )}

          {results.jobs.length > 0 ? (
            <section aria-labelledby="matches-heading" className="flex flex-col gap-3">
              <h2 id="matches-heading" className="text-lg font-semibold">Job matches</h2>
              <ul className="grid gap-4">
                {results.jobs.map((job) => <li key={job.url ?? `${job.company}:${job.similarity_rank}`}><JobCard job={job} /></li>)}
              </ul>
            </section>
          ) : results.blockedJobs.length > 0 ? (
            <p className="text-sm text-muted-foreground">No other matches were found. Review the flagged postings below if you want to.</p>
          ) : (
            <p role="status" className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              No matching jobs found. Try a different role, skill, or phrase.
            </p>
          )}

          {results.blockedJobs.length > 0 && (
            <section aria-labelledby="review-heading" className="flex flex-col gap-3">
              <div>
                <h2 id="review-heading" className="text-lg font-semibold">Possible conditions to review</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  These matches are shown separately, not hidden. Review the posting and decide what works for you.
                </p>
              </div>
              <ul className="grid gap-4">
                {results.blockedJobs.map((job) => <li key={job.url ?? `${job.company}:${job.similarity_rank}`}><JobCard job={job} flagged /></li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
