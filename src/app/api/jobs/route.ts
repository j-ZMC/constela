import { execFile } from "node:child_process";
import { join } from "node:path";
import { parseJobSearchRequest, parseWorkerResult } from "@/lib/jobs";
import { pythonExecutable } from "@/lib/python";

const TIMEOUT_MS = 120_000;
// The same search within 10 minutes answers at once: no Python run, no OpenAI call. Job data changes only when the
// backend files are rebuilt, so a short cache never shows stale jobs for long.
// shortcut: in memory, per server process, emptied on restart; use a shared store if Constela runs on several servers.
const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 100;
const cache: Map<string, { at: number; result: unknown }> = ((globalThis as { __constelaJobsCache?: Map<string, { at: number; result: unknown }> })
  .__constelaJobsCache ??= new Map());
// Internships are a small file of their own (backend/collect_internships.py), so all of them are shown,
// closest to the search first, instead of only the top matches.
const INTERNSHIP_ARGS = [
  "--jobs", "data/raw/jobs/internships.json",
  "--emb", "data/processed/embeddings/internships_openai_embeddings.npy",
  "--ids", "data/processed/embeddings/internships_openai_ids.json",
  "--threshold=-100",
];

function fail(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

function runWorker(python: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      python,
      args,
      {
        cwd: join(process.cwd(), "backend"),
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: TIMEOUT_MS,
      },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseJobSearchRequest(body);
  if (!parsed) return fail("invalid_input", "Enter a valid job search.", 400);
  if (!process.env.OPENAI_API_KEY) {
    return fail("not_configured", "The jobs service is not configured.", 503);
  }

  const python = pythonExecutable();
  const args = [
    "filter_jobs_openai.py",
    "--json",
    "--query",
    parsed.query,
    ...parsed.userBlockers.flatMap((blocker) => ["--blocker", blocker]),
    // "=" form: a word that starts with "-" must not be read as an option.
    ...parsed.customBlockers.map((word) => `--custom-blocker=${word}`),
    ...(parsed.internships ? INTERNSHIP_ARGS : []),
  ];

  const key = JSON.stringify(args);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.result);

  try {
    const output = await runWorker(python, args);
    const result = parseWorkerResult(JSON.parse(output));
    if (!result) return fail("backend_failed", "The jobs service returned an invalid response.", 502);
    cache.delete(key);
    cache.set(key, { at: Date.now(), result });
    // Oldest first: a Map keeps insertion order.
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ETIMEDOUT") {
      return fail("timeout", "The job search took too long. Try again.", 504);
    }
    return fail("backend_failed", "Could not search jobs right now.", 502);
  }
}
