import { useState, type ReactNode } from "react";
import { BadgeCheck, Bookmark, ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SIZE_NAMES } from "@/lib/company-facts";
import { formatPay, type Job } from "@/lib/jobs";
import { jobKey, saveJob, unsaveJob, useSavedJobs } from "@/lib/saved-jobs";

function SaveButton({ job }: { job: Job }) {
  const saved = useSavedJobs().some((s) => jobKey(s.job) === jobKey(job));
  const [problem, setProblem] = useState("");
  function toggle() {
    if (saved) return unsaveJob(jobKey(job));
    const result = saveJob(job);
    setProblem(
      result === "full" ? "You have 50 saved jobs. Remove one in Saved to save another."
      : result === "failed" ? "This browser could not save the job. Check its storage settings."
      : "",
    );
  }
  return (
    <>
      <Button
        type="button"
        variant={saved ? "secondary" : "outline"}
        aria-pressed={saved}
        aria-label={`Save job: ${job.title}`}
        onClick={toggle}
        className="h-11 gap-2 px-4 text-base"
      >
        <Bookmark aria-hidden className={`size-4 ${saved ? "fill-current" : ""}`} />
        {saved ? "Saved" : "Save"}
      </Button>
      {problem && <p role="alert" className="w-full text-sm">{problem}</p>}
    </>
  );
}

function salary(job: Job): string | null {
  const pay = formatPay(job);
  return pay && `Pay: ${pay}`;
}

// Sources give an ISO string, milliseconds (Lever), an empty string or nothing.
function posted(date: Job["date"]): string | null {
  if (date === null || date === "") return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? String(date) : `Posted ${parsed.toLocaleDateString()}`;
}

function companySignal(job: Job): string {
  if (job.company_verified) return "Company verified, not this job";
  if (job.company_verification_status === "qualified") return "Inclusion signal found";
  if (job.company_verification_status === "not_qualified") return "Below current inclusion threshold";
  return "No inclusion data";
}

function workMode(job: Job): string {
  const labels: Record<Job["modality_classification"], string> = {
    remote: "Remote",
    remote_inferred: "Probably remote",
    on_site: "On-site",
    on_site_inferred: "Probably on-site",
    hybrid: "Hybrid",
    hybrid_inferred: "Probably hybrid",
    unknown: job.modality || "Work mode not listed",
  };
  return labels[job.modality_classification];
}

// children: extra parts shown above the footer (Saved adds the company guide and "I sent my application").
export function JobCard({ job, flagged = false, compact = false, children }: { job: Job; flagged?: boolean; compact?: boolean; children?: ReactNode }) {
  const description = job.description.trim();
  const excerpt = description.length > 280 ? `${description.slice(0, 280).trimEnd()}…` : description;

  return (
    <article className="flex h-full flex-col gap-3 p-5 sm:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">{job.company}</p>
          {job.company_verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20">
              <BadgeCheck aria-hidden className="size-3.5" />
              Verified
            </span>
          )}
        </div>
        <h3 className="mt-1 text-lg font-semibold leading-snug">{job.title}</h3>
      </div>

      <ul aria-label="Job details" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <li>{job.location}</li>
        <li>{workMode(job)}</li>
        {salary(job) && <li>{salary(job)}</li>}
        {job.company_size && <li>{SIZE_NAMES[job.company_size.size]}</li>}
        {posted(job.date) && <li>{posted(job.date)}</li>}
      </ul>

      <p className={`text-sm leading-relaxed ${compact ? "line-clamp-3" : ""}`}>{excerpt || "No description provided."}</p>
      {!compact && description.length > 280 && (
        <details>
          <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-medium underline underline-offset-4">
            Read full description
          </summary>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{description}</p>
        </details>
      )}

      {flagged && (
        <div className="rounded-lg bg-secondary p-3 text-sm">
          <p className="font-semibold">Check these before you apply</p>
          <ul className="mt-1 list-inside list-disc">
            {job.block_reasons.map((reason) => <li key={reason.barrier_id}>{reason.label}</li>)}
          </ul>
        </div>
      )}

      {children}

      <div className="mt-auto flex flex-col gap-3 border-t pt-3">
        <p className="text-sm text-muted-foreground">{companySignal(job)} · {job.source}</p>
        <div className="flex flex-wrap gap-2">
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open job posting: ${job.title}, in a new tab`}
              className={buttonVariants({ variant: "outline", className: "h-11 w-fit gap-2 px-4 text-base" })}
            >
              Open job posting <ExternalLink aria-hidden className="size-4" />
            </a>
          )}
          <SaveButton job={job} />
        </div>
      </div>
    </article>
  );
}
