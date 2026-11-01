import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseResumeProfile } from "@/lib/resume";
import { ResumeWorkerError, runResumeParser } from "@/lib/resume-worker";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ERRORS = {
  invalid_input: { status: 400, message: "Choose a PDF resume to upload." },
  unsupported_file: { status: 415, message: "Only PDF resumes are supported." },
  file_too_large: { status: 413, message: "The PDF must be smaller than 5 MB." },
  parse_failed: { status: 422, message: "We could not read text from this PDF. Try a text-based PDF." },
  unavailable: { status: 503, message: "Resume parsing is not available on this server." },
  timeout: { status: 504, message: "Resume parsing took too long. Try again." },
} as const;

type ErrorCode = keyof typeof ERRORS;

function failure(code: ErrorCode) {
  const error = ERRORS[code];
  return Response.json({ error: { code, message: error.message } }, { status: error.status });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return failure("invalid_input");
  if (file.size > MAX_FILE_BYTES) return failure("file_too_large");

  const name = file.name.toLowerCase();
  const supportedType = !file.type || file.type === "application/pdf" || file.type === "application/octet-stream";
  if (!name.endsWith(".pdf") || !supportedType) return failure("unsupported_file");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (header !== "%PDF-") return failure("unsupported_file");

  const tempPath = join(tmpdir(), `constela-resume-${randomUUID()}.pdf`);
  try {
    await writeFile(tempPath, bytes, { flag: "wx" });
    const profile = parseResumeProfile(await runResumeParser(tempPath));
    return profile ? Response.json({ profile }) : failure("parse_failed");
  } catch (error) {
    if (error instanceof ResumeWorkerError) return failure(error.code);
    return failure("parse_failed");
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}
