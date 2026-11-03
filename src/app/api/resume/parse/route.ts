import { spawn } from "node:child_process";
import { join } from "node:path";
import { parseResumeProfile } from "@/lib/resume";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const TIMEOUT_MS = 30_000;

function fail(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

function runParser(pdf: Buffer): Promise<string> {
  const python =
    process.env.PYTHON_EXECUTABLE ??
    join(
      process.cwd(),
      ".venv",
      process.platform === "win32" ? "Scripts" : "bin",
      process.platform === "win32" ? "python.exe" : "python",
    );
  const script = join(process.cwd(), "backend", "resume_parser.py", "resume_parser.py");

  return new Promise((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ python, [script, "--stdin-json"], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let timedOut = false;
    let outputTooLarge = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout, "utf8") > MAX_OUTPUT_BYTES) {
        outputTooLarge = true;
        child.kill();
      }
    });
    child.stderr.resume();
    child.stdin.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code !== "EPIPE") reject(error);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) reject(Object.assign(new Error(), { code: "ETIMEDOUT" }));
      else if (outputTooLarge) reject(Object.assign(new Error(), { code: "OUTPUT_LIMIT" }));
      else if (code === 2) reject(Object.assign(new Error(), { code: "INVALID_PDF" }));
      else if (code !== 0) reject(Object.assign(new Error(), { code: "PARSER_FAILED" }));
      else resolve(stdout);
    });
    child.stdin.end(pdf);
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_PDF_BYTES + 64 * 1024) {
    return fail("file_too_large", "The PDF must be 10 MB or smaller.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("invalid_input", "Choose a PDF resume first.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("invalid_input", "Choose a PDF resume first.", 400);
  }
  if (file.size > MAX_PDF_BYTES) {
    return fail("file_too_large", "The PDF must be 10 MB or smaller.", 413);
  }
  if (file.type !== "application/pdf") {
    return fail("invalid_file_type", "Choose a PDF file.", 400);
  }

  const pdf = Buffer.from(await file.arrayBuffer());
  if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    return fail("invalid_file_type", "Choose a valid PDF file.", 400);
  }

  try {
    const output = await runParser(pdf);
    const result: unknown = JSON.parse(output);
    const profile = parseResumeProfile(
      typeof result === "object" && result !== null && "profile" in result
        ? result.profile
        : null,
    );
    if (!profile) {
      return fail("invalid_response", "Could not read this PDF. Use a text-based PDF.", 422);
    }
    return Response.json({ profile });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ETIMEDOUT") {
      return fail("timeout", "Reading this PDF took too long. Try a smaller file.", 504);
    }
    if (error instanceof Error && "code" in error && error.code === "INVALID_PDF") {
      return fail("unreadable_pdf", "Could not read this PDF. Use a text-based PDF.", 422);
    }
    console.error(
      "CV parser request failed:",
      error instanceof Error && "code" in error ? error.code : "invalid parser response",
    );
    return fail("parser_failed", "Could not read this PDF right now.", 503);
  }
}
