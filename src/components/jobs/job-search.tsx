"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JobCard } from "@/components/jobs/job-card";
import { effectiveBarrierPreferences } from "@/lib/barrier-preferences";
import { searchJobs, type Job, type JobSearchRequest, type JobSearchResponse } from "@/lib/jobs";
import { loadProfile, toJobPreferences } from "@/lib/profile";

// The work conditions the filter checks: saved choices, or the ones the profile points to.
export function jobFilter(): string[] {
  return effectiveBarrierPreferences(toJobPreferences(loadProfile() ?? {}).barriers);
}

// One calm message for every failure, in the plan's voice, with a way forward.
export function JobsProblem({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <p className="font-semibold">We can&apos;t look for jobs right now.</p>
      <p className="text-muted-foreground">It is not your fault. Try again in a moment. Your plan is still here.</p>
      <div className="flex flex-wrap gap-3">
        <Button size="touch" onClick={onRetry}>
          Try again
        </Button>
        <Link href="/plan" className={buttonVariants({ variant: "outline", size: "touch" })}>
          Back to my plan
        </Link>
      </div>
    </div>
  );
}

// Jobs first, the ones to check after: a mark never hides a job.
export function JobResults({ results }: { results: JobSearchResponse }) {
  const key = (job: Job) => job.url ?? `${job.company}:${job.similarity_rank}`;
  const count = results.jobs.length;
  return (
    <div className="flex flex-col gap-6">
      <p role="status" className={results.saved ? "rounded-xl bg-secondary p-4" : "text-muted-foreground"}>
        {/* Saved results say so first, so nobody takes them for an answer to what they typed. */}
        {results.saved
          ? "We can't search right now. These are jobs from an earlier search, so they may not match what you typed and they don't point out what you asked us to watch for."
          : count === 0 && results.blockedJobs.length === 0
          ? "No jobs found. Try other words, like a job title or a skill."
          : `${count} ${count === 1 ? "job" : "jobs"} found${results.blockedJobs.length ? `, and ${results.blockedJobs.length} to check` : ""}.`}
      </p>
      {count > 0 && (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          {results.jobs.map((job) => (
            <li key={key(job)}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
      {results.blockedJobs.length > 0 && (
        <section aria-labelledby="check-heading" className="flex flex-col gap-3">
          <h3 id="check-heading" className="text-lg font-semibold">
            Jobs to check first
          </h3>
          <p className="text-muted-foreground">These posts mention something you asked us to point out.</p>
          <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
            {results.blockedJobs.map((job) => (
              <li key={key(job)}>
                <JobCard job={job} flagged />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function JobSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JobSearchResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function run(request: JobSearchRequest) {
    setLoading(true);
    setFailed(false);
    setResults(null);
    try {
      setResults(await searchJobs(request));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim()) run({ query, userBlockers: jobFilter() });
  }

  return (
    <div className="flex flex-col gap-6">
      <form data-tour="jobs-search" onSubmit={submit} className="flex flex-col gap-3">
        <Label htmlFor="job-query" className="text-base font-semibold">
          What kind of job are you looking for?
        </Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="job-query"
            type="search"
            required
            maxLength={200}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="For example: remote data entry"
            className="h-11 flex-1 text-base md:text-base"
          />
          <Button type="submit" size="touch" disabled={loading || !query.trim()}>
            {loading ? "Looking…" : "Find jobs"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          We use your profile to point out things you asked about.{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            How we keep your data private
          </Link>
        </p>
      </form>

      {loading && (
        <p role="status" className="text-muted-foreground">
          Looking for jobs…
        </p>
      )}
      {failed && <JobsProblem onRetry={() => run({ query, userBlockers: jobFilter() })} />}
      {results && <JobResults results={results} />}
    </div>
  );
}
