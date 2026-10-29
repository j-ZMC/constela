import { parseJobSearchRequest, parseWorkerResult } from "@/lib/jobs";
import { JobsWorkerError, runJobsWorker } from "@/lib/jobs-worker";

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
  if (!process.env.OPENAI_API_KEY?.trim()) return failure("not_configured");

  try {
    const result = parseWorkerResult(await runJobsWorker(input));
    return result ? Response.json(result) : failure("backend_failed");
  } catch (error) {
    return failure(error instanceof JobsWorkerError ? error.code : "backend_failed");
  }
}
