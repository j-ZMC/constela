import { BadgeCheck, ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Job } from "@/lib/jobs";

function salary(job: Job): string | null {
  if (job.salary_min === null && job.salary_max === null) return null;
  const low = job.salary_min?.toLocaleString() ?? "—";
  const high = job.salary_max?.toLocaleString() ?? "—";
  return `${job.currency ? `${job.currency} ` : ""}${low} – ${high}`;
}

function companySignal(job: Job): string {
  if (job.company_verification_status === "qualified") return "Inclusion signal found";
  if (job.company_verification_status === "not_qualified") return "Below current inclusion threshold";
  return "No inclusion data";
}

function workMode(job: Job): string {
  const labels: Record<Job["modality_classification"], string> = {
    remote: "Remote",
    remote_inferred: "Remote (NLP match)",
    on_site: "On-site",
    on_site_inferred: "On-site (NLP match)",
    hybrid: "Hybrid",
    hybrid_inferred: "Hybrid (NLP match)",
    unknown: job.modality || "Not specified",
  };
  return labels[job.modality_classification];
}

export function JobCard({ job, flagged = false }: { job: Job; flagged?: boolean }) {
  const description = job.description.trim();
  const excerpt = description.length > 280 ? `${description.slice(0, 280).trimEnd()}…` : description;

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">{job.company}</p>
            {job.company_verified && (
              <span
                title="Meets current company-inclusion criteria; this does not verify job accessibility."
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20"
              >
                <BadgeCheck aria-hidden className="size-3.5" />
                Verified
              </span>
            )}
          </div>
          <h3 className="mt-1 text-lg font-semibold leading-snug">
            {job.url ? (
              <a href={job.url} target="_blank" rel="noreferrer" className="underline decoration-transparent underline-offset-4 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {job.title}
              </a>
            ) : job.title}
          </h3>
        </div>
        <span className="rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground">
          Result #{job.similarity_rank}
        </span>
      </div>

      <ul aria-label="Job details" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <li>{job.location}</li>
        <li>Work mode: {workMode(job)}</li>
        {salary(job) && <li>{salary(job)}</li>}
        <li>{String(job.date)}</li>
      </ul>

      <p className="text-sm leading-relaxed">{excerpt || "No description provided."}</p>
      {description.length > 280 && (
        <details>
          <summary className="w-fit cursor-pointer text-sm font-medium underline underline-offset-4">
            Read full description
          </summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{description}</p>
        </details>
      )}

      {flagged && (
        <div className="rounded-lg border border-amber-700/30 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Review these possible condition matches</p>
          <ul className="mt-1 list-inside list-disc">
            {job.block_reasons.map((reason) => <li key={reason.barrier_id}>{reason.label}</li>)}
          </ul>
          <p className="mt-2">This is a signal to review the posting, not a decision about whether the job is right for you.</p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p
          className="text-xs text-muted-foreground"
          title="Company-inclusion status is based on available data and does not confirm job accessibility."
        >
          {job.company_verified ? job.source : `${companySignal(job)} · ${job.source}`}
        </p>
        {job.url && (
          <a href={job.url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", className: "h-10 gap-2" })}>
            Open job posting <ExternalLink aria-hidden className="size-4" />
          </a>
        )}
      </div>
    </article>
  );
}
