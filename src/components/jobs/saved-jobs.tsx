"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { companyFacts } from "@/lib/company-facts";
import { companyResearch } from "@/lib/company-research";
import { formatPay, type Job } from "@/lib/jobs";
import { postingSummary } from "@/lib/posting-summary";
import { jobKey, markApplied, updateSaved, useSavedJobs, type SavedJob } from "@/lib/saved-jobs";
import { useSingleFlight } from "@/lib/use-single-flight";

export function SavedJobs() {
  const saved = useSavedJobs();
  if (!saved.length) {
    return (
      <p role="status" className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No saved jobs yet. Press Save on a job you like in Jobs or Internships. Saved jobs stay on this device.
      </p>
    );
  }
  return (
    <ul aria-label="Saved jobs" className="divide-y overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(36_59_83/0.05),0_8px_24px_-12px_rgb(36_59_83/0.12)]">
      {saved.map((item) => (
        <li key={jobKey(item.job)}>
          <JobCard job={item.job} flagged={item.job.blocked} compact>
            <CompanyGuide item={item} />
            <Applied item={item} />
          </JobCard>
        </li>
      ))}
    </ul>
  );
}

function CompanyGuide({ item }: { item: SavedJob }) {
  const { job } = item;
  const facts = companyFacts(job);
  return (
    <details className="rounded-lg bg-secondary p-3 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Get to know the company</summary>
      <div className="flex flex-col gap-4 pb-1">
        <div>
          <h4 className="font-semibold">What we know about {job.company}</h4>
          {facts.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-5">{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
          ) : (
            <p className="mt-1">We have no inclusion data about this company yet.</p>
          )}
          <p className="mt-1 text-muted-foreground">This is about the whole company, not this job or team.</p>
        </div>
        <CompanyPay job={job} />
        <LookUp item={item} />
        <div className="flex flex-col gap-2">
          <Link href={`/learn?job=${encodeURIComponent(jobKey(job))}`} className="flex min-h-11 w-fit items-center font-medium underline underline-offset-4">
            Courses for what this job asks
          </Link>
          <Link href={`/interview?saved=${encodeURIComponent(jobKey(job))}`} className="flex min-h-11 w-fit items-center font-medium underline underline-offset-4">
            Practice an interview for this job
          </Link>
        </div>
      </div>
    </details>
  );
}

// Pay from Constela's own job data: this job's posting, and other postings from the same company.
function CompanyPay({ job }: { job: Job }) {
  const own = formatPay(job);
  const others = (job.company_pay ?? []).flatMap((e) => {
    const pay = formatPay(e);
    return pay ? [`${e.title}: ${pay}`] : [];
  });
  return (
    <div>
      <h4 className="font-semibold">What {job.company} pays</h4>
      {own || others.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {own && <li>This job: {own}</li>}
          {others.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : (
        <p className="mt-1">Our job data has no pay for this company. The search below can look for it.</p>
      )}
      {others.length > 0 && <p className="mt-1 text-muted-foreground">From other job postings by {job.company} in Constela.</p>}
    </div>
  );
}

const FAILED = "Could not look up the company. Try again.";
const PROBLEMS: Record<string, string> = {
  not_configured: "Looking things up online is not set up on this computer.",
  timeout: "The search took too long. Try again.",
};

// POSTs and checks the answer; the error code when it fails.
async function ask<T>(url: string, body: object, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data: unknown = await res.json().catch(() => null);
    const parsed = schema.safeParse(data);
    if (res.ok && parsed.success) return { data: parsed.data };
    return { error: (data as { error?: string } | null)?.error ?? "failed" };
  } catch {
    return { error: "failed" };
  }
}

// One button looks up both: the job's own page (experience it asks for) and the web (the company).
function LookUp({ item }: { item: SavedJob }) {
  const { job, research, posting } = item;
  const [busy, setBusy] = useState(false);
  // Each lookup is two paid AI calls: a double tap must not make four.
  const once = useSingleFlight();
  const [problem, setProblem] = useState("");

  async function lookUp() {
    setBusy(true);
    setProblem("");
    const [web, page] = await Promise.all([
      ask("/api/company/research", { company: job.company.slice(0, 100), title: job.title.slice(0, 160), location: job.location.slice(0, 120) }, companyResearch),
      job.url
        ? ask("/api/jobs/posting", { url: job.url, title: job.title.slice(0, 160), description: job.description.slice(0, 4000) }, postingSummary)
        : Promise.resolve({ data: undefined, error: "failed" }),
    ]);
    updateSaved(jobKey(job), { research: web.data ?? research, posting: page.data ?? posting });
    const failed = [web, page].find((r) => r.error);
    if (failed) setProblem(PROBLEMS[failed.error ?? ""] ?? FAILED);
    setBusy(false);
  }

  return (
    <>
      <div>
        <h4 className="font-semibold">Experience they ask for</h4>
        {posting ? (
          posting.required.length || posting.nice.length ? (
            <>
              {posting.required.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-5">{posting.required.map((line) => <li key={line}>{line}</li>)}</ul>}
              {posting.nice.length > 0 && (
                <>
                  <p className="mt-2 font-medium">Nice to have, not needed:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">{posting.nice.map((line) => <li key={line}>{line}</li>)}</ul>
                </>
              )}
            </>
          ) : (
            <p className="mt-1">The posting does not say what experience it needs.</p>
          )
        ) : (
          <p className="mt-1">Look it up below to read the job&apos;s page and list the experience it asks for.</p>
        )}
        {posting && (
          <p className="mt-1 text-muted-foreground">
            {posting.from === "page" ? "From the job's own page." : "The job's page could not be opened, so this comes from the part of the posting Constela has."}{" "}
            Many jobs hire people with less than everything on the list.
          </p>
        )}
      </div>
      <div>
        <h4 className="font-semibold">From the internet</h4>
      {research ? (
        <>
          <ul className="mt-1 list-disc space-y-1 pl-5">{research.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
          {research.sources.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-muted-foreground">Sources:</span>
              {research.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">
                  {source.site} <ExternalLink aria-hidden className="size-3.5" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ))}
            </p>
          )}
          <p className="mt-1 text-muted-foreground">
            Found on {new Date(research.at).toLocaleDateString()}. Information online can be wrong or old; check the sources.
          </p>
        </>
      ) : (
        <p className="mt-1">An AI can search the web for what this company does, what it pays, how it talks about inclusion, and how its interviews work.</p>
      )}
      <Button type="button" variant="outline" disabled={busy} onClick={() => once(lookUp)} className="mt-2 h-11 px-4 text-base">
        {busy ? "Looking it up… (about 10 seconds)" : research || posting ? "Look it up again" : `Look up ${job.company} online`}
      </Button>
      {problem && <p role="alert" className="mt-1">{problem}</p>}
      <p className="mt-1 text-muted-foreground">
        We read the job&apos;s page and look the company up online. Nothing about you is sent.{" "}
        <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">How we keep your data private</Link>
      </p>
      </div>
    </>
  );
}

function Applied({ item }: { item: SavedJob }) {
  if (item.appliedAt) {
    return <p className="text-sm font-medium">You sent your application on {new Date(item.appliedAt).toLocaleDateString()}.</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" className="h-11 w-fit px-4 text-base" onClick={() => markApplied(jobKey(item.job))}>
        I sent my application
      </Button>
      <p className="text-sm text-muted-foreground">Press this after you apply on the company&apos;s site. Constela never sends anything for you.</p>
    </div>
  );
}
