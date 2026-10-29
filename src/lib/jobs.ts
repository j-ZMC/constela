import { z } from "zod";
import barrierCatalog from "../../backend/config/neurodivergence_job_barriers.json";

const barrierIds = new Set(
  barrierCatalog.categories.flatMap((category) => category.subtypes.map((subtype) => `${category.id}:${subtype.id}`)),
);

const requestSchema = z.object({
  query: z.string().trim().min(1).max(200),
  userBlockers: z.array(z.string()).max(33).default([]),
}).strict();

export type JobSearchRequest = z.infer<typeof requestSchema>;

export function parseJobSearchRequest(value: unknown): JobSearchRequest | null {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success || parsed.data.userBlockers.some((id) => !barrierIds.has(id))) return null;
  return parsed.data;
}

const blockReasonSchema = z.object({
  barrier_id: z.string(),
  category_id: z.string(),
  category_name: z.string(),
  subtype_id: z.string(),
  label: z.string(),
  score: z.number().finite(),
});

const jobSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  modality: z.string(),
  modality_classification: z.enum([
    "remote",
    "remote_inferred",
    "on_site",
    "on_site_inferred",
    "hybrid",
    "hybrid_inferred",
    "unknown",
  ]),
  salary_min: z.number().finite().nullable(),
  salary_max: z.number().finite().nullable(),
  currency: z.string(),
  description: z.string(),
  url: z.string(),
  date: z.union([z.string(), z.number()]).nullable(),
  source: z.string(),
  tags: z.array(z.string()),
  similarity: z.number().finite(),
  similarity_rank: z.number().int().positive(),
  blocked: z.boolean(),
  block_reasons: z.array(blockReasonSchema),
  company_verified: z.boolean(),
  company_verification_status: z.enum(["qualified", "not_qualified", "unknown"]),
});

const workerResultSchema = z.object({
  jobs: z.array(jobSchema),
  blocked_jobs: z.array(jobSchema),
  summary: z.object({
    query: z.string(),
    selected_blockers: z.array(z.string()),
    input_jobs: z.number().int().nonnegative(),
    jobs_excluded_by_company: z.number().int().nonnegative(),
    companies_excluded: z.number().int().nonnegative(),
    jobs_scored: z.number().int().nonnegative(),
    similarity_matches: z.number().int().nonnegative(),
    requested_modalities: z.array(z.enum(["remote", "on_site", "hybrid"])),
    modality_filter_applied: z.boolean(),
    modality_excluded_matches: z.number().int().nonnegative(),
    blocked_similarity_matches: z.number().int().nonnegative(),
    visible_matches: z.number().int().nonnegative(),
    verified_company_matches: z.number().int().nonnegative(),
    similarity_threshold: z.number().finite().nullable(),
  }),
});

export type Job = Omit<z.infer<typeof jobSchema>, "url"> & { url: string | null };
export type JobSearchResponse = {
  jobs: Job[];
  blockedJobs: Job[];
  summary: {
    query: string;
    selectedBlockers: string[];
    inputJobs: number;
    jobsExcludedByCompany: number;
    companiesExcluded: number;
    jobsScored: number;
    similarityMatches: number;
    requestedModalities: Array<"remote" | "on_site" | "hybrid">;
    modalityFilterApplied: boolean;
    modalityExcludedMatches: number;
    blockedMatches: number;
    visibleMatches: number;
    verifiedCompanyMatches: number;
    similarityThreshold: number | null;
  };
};

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseWorkerResult(value: unknown): JobSearchResponse | null {
  const parsed = workerResultSchema.safeParse(value);
  if (!parsed.success) return null;
  const { jobs, blocked_jobs: blockedJobs, summary } = parsed.data;
  return {
    jobs: jobs.map((job) => ({ ...job, url: safeHttpUrl(job.url) })),
    blockedJobs: blockedJobs.map((job) => ({ ...job, url: safeHttpUrl(job.url) })),
    summary: {
      query: summary.query,
      selectedBlockers: summary.selected_blockers,
      inputJobs: summary.input_jobs,
      jobsExcludedByCompany: summary.jobs_excluded_by_company,
      companiesExcluded: summary.companies_excluded,
      jobsScored: summary.jobs_scored,
      similarityMatches: summary.similarity_matches,
      requestedModalities: summary.requested_modalities,
      modalityFilterApplied: summary.modality_filter_applied,
      modalityExcludedMatches: summary.modality_excluded_matches,
      blockedMatches: summary.blocked_similarity_matches,
      visibleMatches: summary.visible_matches,
      verifiedCompanyMatches: summary.verified_company_matches,
      similarityThreshold: summary.similarity_threshold,
    },
  };
}

const apiJobSchema = jobSchema.extend({ url: z.string().nullable() });
const apiResponseSchema = z.object({
  jobs: z.array(apiJobSchema),
  blockedJobs: z.array(apiJobSchema),
  summary: z.object({
    query: z.string(),
    selectedBlockers: z.array(z.string()),
    inputJobs: z.number().int().nonnegative(),
    jobsExcludedByCompany: z.number().int().nonnegative(),
    companiesExcluded: z.number().int().nonnegative(),
    jobsScored: z.number().int().nonnegative(),
    similarityMatches: z.number().int().nonnegative(),
    requestedModalities: z.array(z.enum(["remote", "on_site", "hybrid"])),
    modalityFilterApplied: z.boolean(),
    modalityExcludedMatches: z.number().int().nonnegative(),
    blockedMatches: z.number().int().nonnegative(),
    visibleMatches: z.number().int().nonnegative(),
    verifiedCompanyMatches: z.number().int().nonnegative(),
    similarityThreshold: z.number().finite().nullable(),
  }),
});

const apiErrorSchema = z.object({ code: z.string(), message: z.string() });

export class JobSearchError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export function parseJobSearchResponse(value: unknown): JobSearchResponse | null {
  const parsed = apiResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function searchJobs(request: JobSearchRequest): Promise<JobSearchResponse> {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(
      typeof body === "object" && body !== null && "error" in body ? body.error : null,
    );
    throw new JobSearchError(
      error.success ? error.data.code : "backend_failed",
      error.success ? error.data.message : "Could not search jobs right now.",
    );
  }
  const result = parseJobSearchResponse(body);
  if (!result) throw new JobSearchError("backend_failed", "The jobs service returned an invalid response.");
  return result;
}
