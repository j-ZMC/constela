"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { loadBarrierPreferences } from "@/lib/barrier-preferences";
import { loadProfile } from "@/lib/profile";
import { JobSearchError, searchJobs, type JobSearchResponse } from "@/lib/jobs";
import { buildRecommendedJobsRequest } from "@/lib/recommendations";
import { loadResumeProfile } from "@/lib/local-profile";
import { useHydrated } from "@/lib/use-hydrated";

export function RecommendedJobs() {
  return useHydrated() ? <RecommendedJobsContent /> : null;
}

function RecommendedJobsContent() {
  const [profile] = useState(() => loadResumeProfile());
  const [results, setResults] = useState<JobSearchResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(profile));

  useEffect(() => {
    if (!profile) return;
    let active = true;
    searchJobs(buildRecommendedJobsRequest(profile, loadProfile() ?? {}, loadBarrierPreferences() ?? []))
      .then((value) => { if (active) setResults(value); })
      .catch((cause) => { if (active) setError(cause instanceof JobSearchError ? cause.message : "Could not load recommendations."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile]);

  if (!profile) {
    return (
      <section className="rounded-xl border bg-card p-6" aria-labelledby="recommended-empty-heading">
        <h2 id="recommended-empty-heading" className="text-xl font-semibold">Add your CV to get recommendations</h2>
        <p className="mt-2 text-muted-foreground">We use your skills, sectors, experience, projects, and questionnaire preferences. Contact details stay on this device.</p>
        <Link href="/profile" className="mt-5 inline-flex"><Button className="h-11 px-5">Go to Profile</Button></Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="recommended-heading">
      <div>
        <h2 id="recommended-heading" className="text-2xl font-semibold">Recommended for your profile</h2>
        <p className="mt-2 text-muted-foreground">These jobs use your CV and questionnaire preferences. Contact details are not sent with the search.</p>
      </div>
      {loading && <div role="status" aria-busy="true" className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Finding jobs for your profile…</div>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-card p-4 text-sm">{error}</p>}
      {results && (
        <>
          <p className="text-sm text-muted-foreground">{results.summary.visibleMatches} matches · {results.summary.blockedMatches} flagged for review</p>
          {results.jobs.length ? (
            <ul className="grid gap-4">
              {results.jobs.map((job) => <li key={job.url ?? `${job.company}:${job.similarity_rank}`}><JobCard job={job} /></li>)}
            </ul>
          ) : <p role="status" className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">No recommendations found. Update your CV or questionnaire and try again.</p>}
        </>
      )}
    </section>
  );
}
