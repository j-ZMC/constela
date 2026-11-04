import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InterviewErrorCode } from "@/lib/interview";
import { WhisperError, transcribe, transcribeWithTone } from "@/lib/whisper";

// About 5 minutes of speech from the browser's recorder; an answer is much shorter.
const MAX_BYTES = 5 * 1024 * 1024;
// What browsers record, and the file ending Whisper's decoder needs to read it.
const TYPES: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/wav": "wav", "audio/mpeg": "mp3" };

const STATUS: Record<InterviewErrorCode, number> = { invalid_input: 400, unavailable: 503, timeout: 504, failed: 502 };

function fail(error: InterviewErrorCode) {
  return Response.json({ error }, { status: STATUS[error] });
}

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) return fail("invalid_input");
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const ext = audio instanceof File ? TYPES[audio.type.split(";")[0]] : undefined;
  if (!(audio instanceof File) || !ext || audio.size === 0 || audio.size > MAX_BYTES) return fail("invalid_input");

  // A random name in the system's temp folder. The recording is deleted as soon as Whisper has read it.
  const path = join(tmpdir(), `constela-voice-${randomUUID()}.${ext}`);
  try {
    await writeFile(path, Buffer.from(await audio.arrayBuffer()));
    // tone=1: "Adjust the practice to how it is going" is on. The tone goes back to this browser only, never saved.
    return Response.json(form?.get("tone") === "1" ? await transcribeWithTone(path) : { text: await transcribe(path) });
  } catch (error) {
    return fail(error instanceof WhisperError ? error.code : "failed");
  } finally {
    await rm(path, { force: true });
  }
}
