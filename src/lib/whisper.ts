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

export type Tone = { neutral: number; happy: number; angry: number; sad: number };
const TONE_KEYS = ["neutral", "happy", "angry", "sad"] as const;

// The words, and how the voice sounds to a small model (see transcribe_server.py). Only for "Adjust the practice".
export async function transcribeWithTone(path: string): Promise<{ text: string; tone?: Tone }> {
  const result = await worker.run({ path, tone: true });
  const raw = result.tone as Record<string, unknown> | undefined;
  const tone = raw && TONE_KEYS.every((k) => typeof raw[k] === "number" && raw[k] >= 0 && raw[k] <= 1) ? (raw as Tone) : undefined;
  return { text: String(result.text ?? ""), ...(tone ? { tone } : {}) };
}
