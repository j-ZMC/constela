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
