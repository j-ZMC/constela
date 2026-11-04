// Speech to text on this computer, with Whisper in backend/transcribe_server.py. Server only.
import { WorkerError, pythonWorker } from "@/lib/python-worker";

export { WorkerError as WhisperError };

// The first start can download the model (about 500 MB) and set up CUDA.
const worker = pythonWorker("transcribe_server.py", { readyMs: 300_000, timeoutMs: 60_000 });

export const warmWhisper = worker.warm;

export async function transcribe(path: string, options?: { readyMs?: number; timeoutMs?: number }): Promise<string> {
  const result = await worker.run({ path }, options);
  return String(result.text ?? "");
}

// Seconds from the first sound to the last, and the share of that time spent in pauses (0 to 1).
export type Voice = { seconds: number; pauses: number };

// The words, and how the answer was spoken, measured without a model (see transcribe_server.py). Only for "Adjust the practice".
export async function transcribeWithVoice(path: string): Promise<{ text: string; voice?: Voice }> {
  const result = await worker.run({ path, voice: true });
  const { seconds, pauses } = (result.voice ?? {}) as Record<string, unknown>;
  const ok = typeof seconds === "number" && seconds > 0 && typeof pauses === "number" && pauses >= 0 && pauses <= 1;
  return { text: String(result.text ?? ""), ...(ok ? { voice: { seconds, pauses } } : {}) };
}
