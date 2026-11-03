import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { InterviewErrorCode } from "@/lib/interview";
import { VoiceError, speakToFile } from "@/lib/kokoro";

// One sentence or one short reply at a time: the chat sends each sentence as soon as it is written.
const request = z.object({ text: z.string().trim().min(1).max(600) }).strict();

const STATUS: Record<InterviewErrorCode, number> = { invalid_input: 400, unavailable: 503, timeout: 504, failed: 502 };

function fail(error: InterviewErrorCode) {
  return Response.json({ error }, { status: STATUS[error] });
}

export async function POST(req: Request) {
  const parsed = request.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_input");

  // A random name in the system's temp folder, deleted as soon as the audio is read back.
  const path = join(tmpdir(), `constela-speech-${randomUUID()}.wav`);
  try {
    await speakToFile(parsed.data.text, path);
    return new Response(await readFile(path), { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error instanceof VoiceError ? error.code : "failed");
  } finally {
    await rm(path, { force: true });
  }
}
