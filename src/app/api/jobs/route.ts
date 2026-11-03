import { parseJobSearchRequest, parseWorkerResult } from "@/lib/jobs";
import { JobsWorkerError, runJobsWorker } from "@/lib/jobs-worker";
import savedSearches from "@/data/saved-job-searches.json";

// A few searches saved from real results, so a demo never stops at an error. They skip the person's work conditions,
// so the page says they are saved. shortcut: two fixed queries, drop once the backend is hosted and reliable.
const SAVED: Record<string, unknown> = savedSearches;
const SAVED_TIMEOUT_MS = 25_000;
const savedFor = (query: string) => {
  const hit = SAVED[query.toLowerCase().replace(/\s+/g, " ")];
  return hit ? Response.json({ ...(hit as object), saved: true }) : null;
};

const ERRORS = {
  invalid_input: { status: 400, message: "Enter a valid job-search phrase and profile selection." },
  not_configured: { status: 503, message: "Job search is not configured on this server yet." },
  cache_unavailable: { status: 503, message: "The job-search index is unavailable. Refresh its local cache and try again." },
  timeout: { status: 504, message: "Job search took too long. Try again." },
  unavailable: { status: 503, message: "The local job-search service is unavailable." },
  backend_failed: { status: 502, message: "Could not search jobs right now. Try again later." },
} as const;

type ErrorCode = keyof typeof ERRORS;

function failure(code: ErrorCode) {
  const error = ERRORS[code];
  return Response.json({ error: { code, message: error.message } }, { status: error.status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = parseJobSearchRequest(body);
  if (!input) return failure("invalid_input");
  const saved = savedFor(input.query);
  if (!process.env.OPENAI_API_KEY?.trim()) return saved ?? failure("not_configured");

  try {
    // With saved results to fall back on, don't keep the person waiting the full two minutes.
    const result = parseWorkerResult(await runJobsWorker(input, saved ? { timeoutMs: SAVED_TIMEOUT_MS } : undefined));
    return result ? Response.json(result) : (saved ?? failure("backend_failed"));
  } catch (error) {
    return saved ?? failure(error instanceof JobsWorkerError ? error.code : "backend_failed");
  }
}
