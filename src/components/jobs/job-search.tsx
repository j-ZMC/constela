"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobResults } from "@/components/jobs/job-results";
import { loadBarrierPreferences, loadCustomBlockers } from "@/lib/barrier-preferences";
import { JobSearchError, searchJobs, type JobSearchResponse } from "@/lib/jobs";
import { useSingleFlight } from "@/lib/use-single-flight";

// With no words typed, the internships browser still needs a search to order them by.
const ANY_INTERNSHIP = "internship";

function search(query: string, internships: boolean) {
  const request = { query, userBlockers: loadBarrierPreferences() ?? [], customBlockers: loadCustomBlockers() };
  return searchJobs(internships ? { ...request, internships: true } : request);
}

const failure = (cause: unknown) =>
  cause instanceof JobSearchError ? cause.message : "Could not reach Constela. Check your connection and try again.";

type Page = { query: string; results: JobSearchResponse };

// Search finds the closest jobs to what you type; `home` (the jobs picked for you) shows until the first search.
// With `internships` it is a browser instead: it opens with every internship, and typing only puts the closest first.
// Every search adds a page, and Back returns to the one before, down to `home` or all internships.
export function JobSearch({ internships = false, home }: { internships?: boolean; home?: ReactNode }) {
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(internships);
  const noun = internships ? "internship" : "job";
  const once = useSingleFlight();
  const current = pages.at(-1);
  // The internships browser keeps its first page (all of them): there is nothing before it.
  const canGoBack = pages.length > (internships ? 1 : 0);
  const before = pages.at(-2);
  const backTo = !before ? "jobs for you" : before.query === ANY_INTERNSHIP ? "all internships" : `“${before.query}”`;

  useEffect(() => {
    if (!internships) return;
    let active = true;
    search(ANY_INTERNSHIP, true)
      .then((results) => { if (active) setPages([{ query: ANY_INTERNSHIP, results }]); })
      .catch((cause) => { if (active) setError(failure(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [internships]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const words = query.trim() || (internships ? ANY_INTERNSHIP : "");
    if (!words) return;
    // A double tap would add the same search twice to Back's history.
    void once(async () => {
      setLoading(true);
      setError("");
      try {
        const results = await search(words, internships);
        setPages((list) => [...list, { query: words, results }]);
      } catch (cause) {
        setError(failure(cause));
      } finally {
        setLoading(false);
      }
    });
  }

  function back() {
    setError("");
    setPages((list) => list.slice(0, -1));
    setQuery(before && before.query !== ANY_INTERNSHIP ? before.query : "");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        {internships && (
          <p className="mb-4">
            An internship is a short job where you learn at work. Many are for students or people looking for their
            first job. These come from companies with inclusion data, such as B Corps and Equidad MX.
          </p>
        )}
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-2 font-medium">
            {internships ? "What would you like to learn? (optional)" : "What job are you looking for?"}
            <input
              type="search"
              required={!internships}
              maxLength={200}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={internships ? "For example, marketing or software" : "For example, remote data analyst"}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button type="submit" disabled={loading || (!internships && !query.trim())} className="h-11 px-5 text-base">
            {loading ? "Searching…" : internships ? "Show internships" : "Find jobs"}
          </Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          We point out what you asked us to watch for, and never hide a {noun}.{" "}
          <Link href="/profile" className="font-medium underline underline-offset-4">Change what to watch for</Link>
          {" · "}
          <Link href="/privacy" className="font-medium underline underline-offset-4">How we keep your data private</Link>
        </p>
      </div>

      {canGoBack && !loading && (
        <Button type="button" variant="outline" onClick={back} className="h-11 w-fit gap-2 px-4 text-base">
          <ArrowLeft aria-hidden className="size-4" /> Back to {backTo}
        </Button>
      )}

      {loading && (
        <div role="status" aria-busy="true" className="flex flex-col gap-3" aria-label={`Searching ${noun}s`}>
          <p className="text-sm text-muted-foreground">Looking for {noun}s…</p>
          {/* The shape of the list that is coming, so nothing jumps when it arrives. */}
          <div aria-hidden className="divide-y rounded-2xl border bg-card">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex flex-col gap-2 p-5 sm:p-6">
                <div className="h-4 w-1/4 animate-pulse rounded bg-secondary" />
                <div className="h-5 w-2/3 animate-pulse rounded bg-secondary" />
                <div className="h-4 w-full animate-pulse rounded bg-secondary" />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-card p-4 text-sm">{error}</p>}

      {current && !loading && (
        <div className="flex flex-col gap-6" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            {current.results.summary.visibleMatches} {current.results.summary.visibleMatches === 1 ? noun : `${noun}s`} found
            {current.query !== ANY_INTERNSHIP && ` for “${current.query}”`}
            {internships && current.query !== ANY_INTERNSHIP && ", closest first"}
            {current.results.summary.blockedMatches > 0 && ` · ${current.results.summary.blockedMatches} to review`}
            {current.results.summary.jobsExcludedByCompany > 0 && ` · ${current.results.summary.jobsExcludedByCompany} left out by company data`}
          </p>
          {current.results.summary.modalityFilterApplied && (
            <p role="status" className="text-sm text-muted-foreground">
              Showing {current.results.summary.requestedModalities.map((mode) => mode === "on_site" ? "on-site" : mode).join(", ")} jobs only. {current.results.summary.modalityExcludedMatches} other similar jobs left out.
            </p>
          )}

          {/* key: a new page starts on its first page of results; the filters are kept (job-filters.ts). */}
          <JobResults
            key={pages.length}
            results={current.results}
            label={internships ? "Internships" : "Job matches"}
            filterList={internships ? "internships" : "jobs"}
            emptyText={internships ? "No internships right now. Companies post new ones each season; check again soon." : "No matching jobs found. Try a different role, skill, or phrase."}
          />
        </div>
      )}

      {/* Kept mounted under the searches, so Back shows the jobs for you at once, without loading them again. */}
      {home && <div hidden={Boolean(current) || loading}>{home}</div>}
    </div>
  );
}
