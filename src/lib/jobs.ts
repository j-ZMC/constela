import { z } from "zod";
import barrierCatalog from "../../backend/config/neurodivergence_job_barriers.json";
import { CUSTOM_BLOCKER, MAX_CUSTOM_BLOCKERS } from "@/lib/barrier-preferences";

const barrierIds = new Set(
  barrierCatalog.categories.flatMap((category) => category.subtypes.map((subtype) => `${category.id}:${subtype.id}`)),
);

const requestSchema = z.object({
  query: z.string().trim().min(1).max(200),
  userBlockers: z.array(z.string()).max(33).default([]),
  customBlockers: z.array(z.string().regex(CUSTOM_BLOCKER)).max(MAX_CUSTOM_BLOCKERS).default([]),
  internships: z.literal(true).optional(),
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

const modalityClassificationSchema = z.enum([
  "remote",
  "remote_inferred",
  "on_site",
  "on_site_inferred",
  "hybrid",
  "hybrid_inferred",
  "unknown",
]);

const jobSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  modality: z.string(),
  modality_classification: modalityClassificationSchema.optional(),
  salary_min: z.number().finite().nullable(),
  salary_max: z.number().finite().nullable(),
  currency: z.string(),
  // Set when the pay was read from the posting's text (backend pay_from_text); "$" means no currency code was given.
  salary_period: z.enum(["hour", "month", "year"]).nullable().optional(),
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
  // backend/company_sizes.py: B Corp's data, Y Combinator's team size, the posting itself, a web search, or an AI estimate.
  company_size: z.object({
    size: z.enum(["small", "medium", "large"]),
    source: z.enum(["bcorp", "yc", "posting", "web", "estimate"]),
  }).nullable().optional(),
  // What other jobs at the same company pay, from the same job data (backend company_pay_examples).
  company_pay: z.array(z.object({
    title: z.string(),
    salary_min: z.number().finite().nullable(),
    salary_max: z.number().finite().nullable(),
    currency: z.string(),
    salary_period: z.enum(["hour", "month", "year"]).nullable(),
  })).max(5).optional(),
  // The inclusion scores behind a qualified company (backend load_company_facts); null when there are none.
  company_facts: z.object({
    glassdoor_inclusion_mean: z.number().finite().nullable(),
    glassdoor_reviews: z.number().finite().nullable(),
    glassdoor_legacy_mean: z.number().finite().nullable(),
    glassdoor_legacy_reviews: z.number().finite().nullable(),
    bcorp_score: z.number().finite().nullable(),
    dei_mx_score: z.number().finite().nullable(),
    dei_us_2025_match: z.number().finite().nullable(),
  }).nullable().optional(),
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
    requested_modalities: z.array(z.enum(["remote", "on_site", "hybrid"])).default([]),
    modality_filter_applied: z.boolean().default(false),
    modality_excluded_matches: z.number().int().nonnegative().default(0),
    blocked_similarity_matches: z.number().int().nonnegative(),
    visible_matches: z.number().int().nonnegative(),
    verified_company_matches: z.number().int().nonnegative(),
    similarity_threshold: z.number().finite().nullable(),
  }),
});

export type Job = Omit<z.infer<typeof jobSchema>, "url" | "modality_classification"> & {
  url: string | null;
  modality_classification: z.infer<typeof modalityClassificationSchema>;
};
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

type Pay = { salary_min: number | null; salary_max: number | null; currency: string; salary_period?: "hour" | "month" | "year" | null };

// "USD 54 – 60 per hour", "$18 – $24.95", "USD 800 per month". null when there is no pay.
export function formatPay(pay: Pay): string | null {
  if (pay.salary_min === null && pay.salary_max === null) return null;
  const amount = (value: number | null) => (value === null ? "—" : `${pay.currency === "$" ? "$" : ""}${value.toLocaleString()}`);
  const code = pay.currency && pay.currency !== "$" ? `${pay.currency} ` : "";
  const range = pay.salary_min === pay.salary_max ? amount(pay.salary_min) : `${amount(pay.salary_min)} – ${amount(pay.salary_max)}`;
  return `${code}${range}${pay.salary_period ? ` per ${pay.salary_period}` : ""}`;
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function classifyModality(value: string): z.infer<typeof modalityClassificationSchema> {
  const parsed = modalityClassificationSchema.safeParse(
    value.trim().toLowerCase().replace(/[\s-]+/g, "_"),
  );
  return parsed.success ? parsed.data : "unknown";
}

export function parseWorkerResult(value: unknown): JobSearchResponse | null {
  const parsed = workerResultSchema.safeParse(value);
  if (!parsed.success) return null;
  const { jobs, blocked_jobs: blockedJobs, summary } = parsed.data;
  const mapJob = (job: z.infer<typeof jobSchema>): Job => ({
    ...job,
    modality_classification: job.modality_classification ?? classifyModality(job.modality),
    url: safeHttpUrl(job.url),
  });
  return {
    jobs: jobs.map(mapJob),
    blockedJobs: blockedJobs.map(mapJob),
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

export const apiJobSchema = jobSchema.extend({
  url: z.string().nullable(),
  modality_classification: modalityClassificationSchema,
});
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

// What a person reads when a search fails: what happened and what to do, never a server message (DESIGN.md).
export const JOB_ERRORS: Record<string, string> = {
  invalid_input: "Type a few words about the job you want, then try again.",
  not_configured: "Job search is not set up on this computer yet. It is not your fault.",
  timeout: "The search took too long. Try again in a moment.",
  backend_failed: "We can't look for jobs right now. It is not your fault. Try again in a moment.",
};

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
    const code = error.success ? error.data.code : "backend_failed";
    throw new JobSearchError(code, JOB_ERRORS[code] ?? JOB_ERRORS.backend_failed);
  }
  const result = parseJobSearchResponse(body);
  if (!result) throw new JobSearchError("backend_failed", JOB_ERRORS.backend_failed);
  return result;
}
