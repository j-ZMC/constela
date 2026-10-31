"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { loadBarrierPreferences } from "@/lib/barrier-preferences";
import { loadProfile } from "@/lib/profile";
import { JobSearchError, searchJobs, type JobSearchRequest, type JobSearchResponse } from "@/lib/jobs";
import { buildRecommendedJobsRequest } from "@/lib/recommendations";
import { loadResumeProfile } from "@/lib/local-profile";
import { loadRecommendedCache, saveRecommendedCache } from "@/lib/recommended-cache";
import { useHydrated } from "@/lib/use-hydrated";

const PAGE_SIZE = 10;

export function RecommendedJobs() {
  return useHydrated() ? <RecommendedJobsContent /> : null;
}

function RecommendedJobsContent() {
  const [profile] = useState(() => loadResumeProfile());
  const [request] = useState<JobSearchRequest | null>(() => {
    if (!profile) return null;
    return buildRecommendedJobsRequest(profile, loadProfile() ?? {}, loadBarrierPreferences() ?? []);
  });
  const [cached] = useState(() => request ? loadRecommendedCache(request) : null);
  const [results, setResults] = useState<JobSearchResponse | null>(cached);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(request && !cached));
  const [page, setPage] = useState(1);

  async function refresh() {
    if (!request) return;
    setLoading(true);
    setError("");
    try {
      const value = await searchJobs(request);
      saveRecommendedCache(request, value);
      setResults(value);
      setPage(1);
    } catch (cause) {
      setError(cause instanceof JobSearchError ? cause.message : "Could not load recommendations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!request || cached) return;
    let active = true;
    searchJobs(request)
      .then((value) => {
        if (!active) return;
        saveRecommendedCache(request, value);
        setResults(value);
      })
      .catch((cause) => { if (active) setError(cause instanceof JobSearchError ? cause.message : "Could not load recommendations."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cached, request]);

  if (!profile) {
    return (
      <section className="rounded-xl border bg-card p-6" aria-labelledby="recommended-empty-heading">
        <h2 id="recommended-empty-heading" className="text-xl font-semibold">Add your CV to get recommendations</h2>
        <p className="mt-2 text-muted-foreground">We use your skills, sectors, experience, projects, and questionnaire preferences. Contact details stay on this device.</p>
        <Link href="/profile" className="mt-5 inline-flex"><Button className="h-11 px-5">Go to Profile</Button></Link>
      </section>
    );
  }

  const totalPages = results ? Math.max(1, Math.ceil(results.jobs.length / PAGE_SIZE)) : 1;
  const visibleJobs = results?.jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [];

  return (
    <section className="flex flex-col gap-6" aria-labelledby="recommended-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="recommended-heading" className="text-2xl font-semibold">Recommended for your profile</h2>
          <p className="mt-2 text-muted-foreground">These jobs use your CV and questionnaire preferences. Contact details are not sent with the search.</p>
        </div>
        <Button type="button" variant="outline" onClick={refresh} disabled={loading} className="h-10">{loading ? "Loading…" : "Refresh"}</Button>
      </div>
      {loading && <div role="status" aria-busy="true" className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Finding jobs for your profile…</div>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-card p-4 text-sm">{error}</p>}
      {results && (
        <>
          <p className="text-sm text-muted-foreground">{results.summary.visibleMatches} matches · {results.summary.blockedMatches} flagged for review · page {page} of {totalPages}</p>
          {visibleJobs.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleJobs.map((job) => <li key={job.url ?? `${job.company}:${job.similarity_rank}`}><JobCard job={job} compact /></li>)}
            </ul>
          ) : <p role="status" className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">No recommendations found. Update your CV or questionnaire and refresh.</p>}
          {results.blockedJobs.length > 0 && (
            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer font-semibold">{results.blockedJobs.length} flagged jobs to review</summary>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.blockedJobs.slice(0, PAGE_SIZE).map((job) => <li key={job.url ?? `${job.company}:${job.similarity_rank}`}><JobCard job={job} flagged compact /></li>)}
              </ul>
            </details>
          )}
          {totalPages > 1 && (
            <nav aria-label="Recommended jobs pages" className="flex items-center justify-center gap-3">
              <Button type="button" variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button type="button" variant="outline" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
