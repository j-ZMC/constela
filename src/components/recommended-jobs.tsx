"use client";

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { JobResults } from "@/components/jobs/job-results";
import { Button, buttonVariants } from "@/components/ui/button";
import { loadBarrierPreferences, loadCustomBlockers } from "@/lib/barrier-preferences";
import { loadProfile } from "@/lib/profile";
import { JobSearchError, searchJobs, type JobSearchRequest, type JobSearchResponse } from "@/lib/jobs";
import { buildRecommendedJobsRequest } from "@/lib/recommendations";
import { loadResumeProfile, useResumeSnapshot } from "@/lib/local-profile";
import { loadRecommendedCache, saveRecommendedCache } from "@/lib/recommended-cache";
import { useHydrated } from "@/lib/use-hydrated";
import { Loading } from "@/components/loading";


// Starts again when the CV is added, changed or removed.
export function RecommendedJobs() {
  const cv = useResumeSnapshot();
  return useHydrated() ? <RecommendedJobsContent key={cv ?? ""} /> : <Loading />;
}

function RecommendedJobsContent() {
  const [profile] = useState(() => loadResumeProfile());
  const [request] = useState<JobSearchRequest | null>(() => {
    if (!profile) return null;
    return buildRecommendedJobsRequest(profile, loadProfile() ?? {}, loadBarrierPreferences() ?? [], loadCustomBlockers());
  });
  const [cached] = useState(() => request ? loadRecommendedCache(request) : null);
  const [results, setResults] = useState<JobSearchResponse | null>(cached);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(request && !cached));
  // Changes with every refresh, so the results start again on page 1.
  const [version, setVersion] = useState(0);

  async function refresh() {
    if (!request) return;
    setLoading(true);
    setError("");
    try {
      const value = await searchJobs(request);
      saveRecommendedCache(request, value);
      setResults(value);
      setVersion((v) => v + 1);
    } catch (cause) {
      setError(cause instanceof JobSearchError ? cause.message : "Could not reach Constela. Check your connection and try again.");
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
      .catch((cause) => { if (active) setError(cause instanceof JobSearchError ? cause.message : "Could not reach Constela. Check your connection and try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cached, request]);

  if (!profile) {
    return (
      <section data-tour="for-you" className="rounded-xl border bg-card p-6" aria-labelledby="recommended-empty-heading">
        <h2 id="recommended-empty-heading" className="flex items-center gap-2 text-xl font-semibold"><FileText aria-hidden className="size-6 shrink-0 text-primary" />Add your CV to get recommendations</h2>
        <p className="mt-2 text-muted-foreground">We pick jobs from your skills and experience. You can also search above without a CV.</p>
        <Link href="/profile" className={buttonVariants({ className: "mt-5 h-11 px-5 text-base" })}>Go to Profile</Link>
      </section>
    );
  }

  return (
    <section data-tour="for-you" className="flex flex-col gap-6" aria-labelledby="for-you-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="for-you-heading" className="text-xl font-semibold">Jobs for you</h2>
        <Button type="button" variant="outline" onClick={refresh} disabled={loading} className="h-11 px-5 text-base">{loading ? "Loading…" : "Refresh"}</Button>
      </div>
      {loading && <div role="status" aria-busy="true" className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Finding jobs for your profile…</div>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-card p-4 text-sm">{error}</p>}
      {results && (
        <>
          <JobResults
            key={version}
            results={results}
            label="Jobs for you"
            filterList="jobs"
            emptyText="No recommendations found. Update your CV or questionnaire and refresh."
          />
        </>
      )}
    </section>
  );
}
