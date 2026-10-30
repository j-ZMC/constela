import { spawn } from "node:child_process";
import { resolve } from "node:path";

export type ResumeWorkerErrorCode = "timeout" | "unavailable" | "parse_failed";

export class ResumeWorkerError extends Error {
  constructor(public readonly code: ResumeWorkerErrorCode) {
    super(code);
  }
}

const MAX_OUTPUT_BYTES = 512_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export function runResumeParser(
  filePath: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<unknown> {
  return new Promise((resolveResult, rejectResult) => {
    let child;
    try {
      child = spawn(/*turbopackIgnore: true*/
        process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "python" : "python3"),
        ["resume_api.py", filePath],
        {
          cwd: resolve(process.cwd(), "backend"),
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    } catch {
      rejectResult(new ResumeWorkerError("unavailable"));
      return;
    }

    let output = "";
    let bytes = 0;
    let settled = false;
    const fail = (error: ResumeWorkerError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectResult(error);
    };
    const timer = setTimeout(() => {
      child.kill();
      fail(new ResumeWorkerError("timeout"));
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string | Buffer) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      bytes += Buffer.byteLength(text);
      if (bytes > MAX_OUTPUT_BYTES) {
        child.kill();
        fail(new ResumeWorkerError("parse_failed"));
        return;
      }
      output += text;
    });
    child.stderr?.on("data", () => {});
    child.on("error", () => fail(new ResumeWorkerError("unavailable")));
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        fail(new ResumeWorkerError("parse_failed"));
        return;
      }
      try {
        settled = true;
        clearTimeout(timer);
        resolveResult(JSON.parse(output));
      } catch {
        fail(new ResumeWorkerError("parse_failed"));
      }
    });
  });
}
