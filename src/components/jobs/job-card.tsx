"use client";

import { useState } from "react";
import { BadgeCheck, Check, ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Job } from "@/lib/jobs";
import { addStepToPlan, markEvent } from "@/lib/plan";

const SAVED_KEY = "saved-jobs";

function savedJobs(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function salary(job: Job): string | null {
  if (job.salary_min === null && job.salary_max === null) return null;
  const low = job.salary_min?.toLocaleString() ?? "—";
  const high = job.salary_max?.toLocaleString() ?? "—";
  return `${job.currency ? `${job.currency} ` : ""}${low} – ${high}`;
}

// Plain words: "Probably remote" when the post does not say it outright.
function workMode(job: Job): string {
  const labels: Record<Job["modality_classification"], string> = {
    remote: "Remote",
    remote_inferred: "Probably remote",
    on_site: "On-site",
    on_site_inferred: "Probably on-site",
    hybrid: "Hybrid",
    hybrid_inferred: "Probably hybrid",
    unknown: job.modality || "Work mode not stated",
  };
  return labels[job.modality_classification];
}

export function JobCard({ job, flagged = false }: { job: Job; flagged?: boolean }) {
  const key = job.url ?? `${job.company}:${job.title}`;
  const [saved, setSaved] = useState(() => savedJobs().includes(key));
  const description = job.description.trim();
  const excerpt = description.length > 240 ? `${description.slice(0, 240).trimEnd()}…` : description;

  // Saving closes the loop with My plan: it can finish "Save one job you like" and adds the next step.
  function save() {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify([...savedJobs(), key]));
    } catch {
      // Without storage the plan still gets the step below.
    }
    markEvent("job-saved");
    // My plan only keeps links inside the app, so the step points to Jobs, where the saved post is.
    addStepToPlan({ title: `Read about ${job.company}`.slice(0, 80), minutes: 5, icon: "building", href: "/jobs", stage: "apply" });
    setSaved(true);
  }

  return (
    <article className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          {job.company}
          {job.company_verified && (
            <span
              title="This company meets our inclusion criteria. It does not check this exact job."
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-sm font-medium text-foreground"
            >
              <BadgeCheck aria-hidden className="size-4 text-primary" />
              Inclusive employer
            </span>
          )}
        </p>
        <h3 className="text-lg font-semibold text-balance">{job.title}</h3>
        <ul aria-label="Job details" className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <li>{job.location}</li>
          <li>{workMode(job)}</li>
          {salary(job) && <li>{salary(job)}</li>}
        </ul>
      </div>

      <p className="text-pretty">{excerpt || "This post has no description."}</p>
      {description.length > 240 && (
        <details>
          <summary className="w-fit cursor-pointer font-medium underline underline-offset-4">Read the full post</summary>
          <p className="mt-3 whitespace-pre-line">{description}</p>
        </details>
      )}

      {flagged && (
        <div className="rounded-lg border border-destructive/40 bg-secondary p-4">
          <p className="font-semibold">Check this before you apply</p>
          <ul className="mt-1 list-inside list-disc">
            {job.block_reasons.map((reason) => (
              <li key={reason.barrier_id}>{reason.label}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">This is only a note. You decide if the job works for you.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t pt-4">
        {job.url && (
          <a href={job.url} target="_blank" rel="noreferrer" className={buttonVariants({ size: "touch" })}>
            Open the job post
            <ExternalLink aria-hidden data-icon="inline-end" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        {saved ? (
          <p role="status" className="flex h-11 items-center gap-2 font-medium">
            <Check aria-hidden className="size-5 text-primary" />
            Saved to your plan
          </p>
        ) : (
          <Button variant="outline" size="touch" onClick={save}>
            Save this job
          </Button>
        )}
      </div>
    </article>
  );
}
