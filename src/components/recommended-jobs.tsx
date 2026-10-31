"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { JobResults, JobsProblem, jobFilter } from "@/components/jobs/job-search";
import { loadProfile } from "@/lib/profile";
import { searchJobs, type JobSearchRequest, type JobSearchResponse } from "@/lib/jobs";
import { buildRecommendedJobsRequest } from "@/lib/recommendations";
import { loadResumeProfile } from "@/lib/local-profile";
import { loadRecommendedCache, saveRecommendedCache } from "@/lib/recommended-cache";

const PAGE_SIZE = 5;

// "For you" on the Jobs page: jobs picked from the CV and the profile. Rendered after hydration by the Jobs page.
export function RecommendedJobs({ onSearch }: { onSearch: () => void }) {
  const [profile] = useState(() => loadResumeProfile());
  const [request] = useState<JobSearchRequest | null>(() =>
    profile ? buildRecommendedJobsRequest(profile, loadProfile() ?? {}, jobFilter()) : null,
  );
  const [cached] = useState(() => (request ? loadRecommendedCache(request) : null));
  const [results, setResults] = useState<JobSearchResponse | null>(cached);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(request && !cached));
  const [shown, setShown] = useState(PAGE_SIZE);

  function load() {
    if (!request) return;
    setLoading(true);
    setFailed(false);
    searchJobs(request)
      .then((value) => {
        saveRecommendedCache(request, value);
        setResults(value);
        setShown(PAGE_SIZE);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
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
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [cached, request]);

  if (!profile) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <p className="font-semibold">Add your CV to see jobs picked for you.</p>
        <p className="text-muted-foreground">We use your skills and your profile. Your name and email are never sent.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/profile#cv" className={buttonVariants({ size: "touch" })}>
            Add my CV
          </Link>
          <Button variant="outline" size="touch" onClick={onSearch}>
            Search all jobs
          </Button>
        </div>
      </div>
    );
  }

  // Five at a time, so the list never feels endless.
  const visible = results ? { ...results, jobs: results.jobs.slice(0, shown) } : null;
  return (
    <div className="flex flex-col gap-6">
      {loading && (
        <p role="status" className="text-muted-foreground">
          Picking jobs for you…
        </p>
      )}
      {failed && <JobsProblem onRetry={load} />}
      {visible && <JobResults results={visible} />}
      {results && shown < results.jobs.length && (
        <Button variant="outline" size="touch" className="w-fit" onClick={() => setShown(shown + PAGE_SIZE)}>
          Show 5 more
        </Button>
      )}
      {results && (
        <Button variant="ghost" size="touch" className="w-fit" onClick={load} disabled={loading}>
          Look again
        </Button>
      )}
    </div>
  );
}
