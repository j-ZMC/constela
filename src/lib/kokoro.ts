// The interview AI's voice, made on this computer by Kokoro-82M in backend/speak_server.py. Server only.
import { WorkerError, pythonWorker } from "@/lib/python-worker";

export { WorkerError as VoiceError };

// The first start can download the model (about 340 MB).
const worker = pythonWorker("speak_server.py", { readyMs: 300_000, timeoutMs: 30_000 });

export const warmVoice = worker.warm;

// Writes the spoken text to `path` as a WAV file.
export async function speakToFile(text: string, path: string): Promise<void> {
  await worker.run({ text, path });
}
