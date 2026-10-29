import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { JobSearchRequest } from "@/lib/jobs";

export type JobsWorkerErrorCode = "timeout" | "unavailable" | "cache_unavailable" | "backend_failed";

export class JobsWorkerError extends Error {
  constructor(public readonly code: JobsWorkerErrorCode) {
    super(code);
  }
}

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 8_000_000;
const WORKER_ERRORS = new Set<JobsWorkerErrorCode>(["unavailable", "cache_unavailable", "backend_failed"]);

export function runJobsWorker(
  request: JobSearchRequest,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<unknown> {
  return new Promise((resolveResult, rejectResult) => {
    let child;
    try {
      child = spawn(/*turbopackIgnore: true*/ process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "python" : "python3"), ["jobs_api.py"], {
        cwd: resolve(process.cwd(), "backend"),
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      rejectResult(new JobsWorkerError("unavailable"));
      return;
    }

    let output = "";
    let outputBytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      fail(new JobsWorkerError("timeout"));
    }, timeoutMs);
    const fail = (error: JobsWorkerError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectResult(error);
    };

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string | Buffer) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      outputBytes += Buffer.byteLength(text);
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        fail(new JobsWorkerError("backend_failed"));
        return;
      }
      output += text;
    });
    child.stderr?.on("data", () => {});
    child.on("error", () => fail(new JobsWorkerError("unavailable")));
    child.on("close", (code) => {
      if (settled) return;
      let result: unknown;
      try {
        result = JSON.parse(output);
      } catch {
        fail(new JobsWorkerError("backend_failed"));
        return;
      }
      if (code === 0) {
        settled = true;
        clearTimeout(timer);
        resolveResult(result);
        return;
      }
      const error =
        typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "backend_failed";
      fail(new JobsWorkerError(WORKER_ERRORS.has(error as JobsWorkerErrorCode) ? (error as JobsWorkerErrorCode) : "backend_failed"));
    });
    child.stdin?.on("error", () => fail(new JobsWorkerError("unavailable")));
    child.stdin?.end(JSON.stringify(request));
  });
}
