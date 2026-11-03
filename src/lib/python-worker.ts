// Keeps one long-running Python worker per script (backend/worker_protocol.py has the line protocol), so its
// model loads only once. Used for Whisper (speech to text) and Kokoro (the AI's voice). Server only.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { pythonExecutable } from "@/lib/python";

// "unavailable": the worker could not start or stopped (not installed, for example). "failed": this one request.
export class WorkerError extends Error {
  constructor(public code: "unavailable" | "timeout" | "failed") {
    super(code);
  }
}

type Result = Record<string, unknown>;
type Pending = { resolve: (result: Result) => void; reject: (error: WorkerError) => void; timer: ReturnType<typeof setTimeout> };
type Running = { child: ChildProcessWithoutNullStreams; ready: Promise<void>; pending: Map<string, Pending> };

// On globalThis, so a hot reload in development keeps the running workers instead of starting more.
const store = globalThis as { __constelaWorkers?: Record<string, Running | undefined> };
const running = () => (store.__constelaWorkers ??= {});

function start(script: string): Running {
  const child = spawn(pythonExecutable(), [script], {
    cwd: join(process.cwd(), "backend"),
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1" },
  });
  const pending = new Map<string, Pending>();
  let markReady!: () => void;
  let markFailed!: (error: WorkerError) => void;
  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    markFailed = reject;
  });
  // Nobody may be waiting yet; the failure is still reported to whoever waits next.
  ready.catch(() => {});
  const worker: Running = { child, ready, pending };

  createInterface({ input: child.stdout }).on("line", (line) => {
    let message: Result & { ready?: boolean; id?: string; error?: unknown };
    try {
      message = JSON.parse(line);
    } catch {
      return; // not ours: a library printed something
    }
    if (message.ready) return markReady();
    const request = message.id ? pending.get(message.id) : undefined;
    if (!request) return;
    pending.delete(message.id!);
    clearTimeout(request.timer);
    if (message.error !== undefined) request.reject(new WorkerError("failed"));
    else request.resolve(message);
  });
  // Models write progress to stderr; reading it keeps the pipe from filling up and blocking.
  child.stderr.resume();

  const stop = () => {
    if (running()[script] === worker) running()[script] = undefined;
    markFailed(new WorkerError("unavailable"));
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new WorkerError("unavailable"));
    }
    pending.clear();
  };
  child.on("error", stop);
  child.on("exit", stop);
  return worker;
}

export function pythonWorker(script: string, defaults: { readyMs: number; timeoutMs: number }) {
  const get = () => (running()[script] ??= start(script));
  return {
    // Starts loading the model now, so the first request does not wait for it.
    warm: (): void => {
      get();
    },
    async run(request: Result, { readyMs = defaults.readyMs, timeoutMs = defaults.timeoutMs } = {}): Promise<Result> {
      const w = get();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          w.ready,
          new Promise((_, reject) => (timer = setTimeout(() => reject(new WorkerError("timeout")), readyMs))),
        ]);
      } finally {
        clearTimeout(timer);
      }
      return new Promise<Result>((resolve, reject) => {
        const id = randomUUID();
        const timer = setTimeout(() => {
          w.pending.delete(id);
          reject(new WorkerError("timeout"));
        }, timeoutMs);
        w.pending.set(id, { resolve, reject, timer });
        w.child.stdin.write(`${JSON.stringify({ ...request, id })}\n`);
      });
    },
  };
}
