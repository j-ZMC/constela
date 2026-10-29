import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { runJobsWorker, JobsWorkerError } from "@/lib/jobs-worker";

function createChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdin: EventEmitter & { end: ReturnType<typeof vi.fn> };
    stdout: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdin = Object.assign(new EventEmitter(), { end: vi.fn() });
  child.stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  spawnMock.mockReturnValue(child);
  return child;
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("runJobsWorker", () => {
  it("uses the configured Python environment when provided", async () => {
    const previous = process.env.PYTHON_EXECUTABLE;
    process.env.PYTHON_EXECUTABLE = "C:/python/python.exe";
    const child = createChild();
    const pending = runJobsWorker({ query: "remote analyst", userBlockers: [] }, { timeoutMs: 100 });
    child.stdout.emit("data", '{"jobs":[],"blocked_jobs":[],"summary":{}}');
    child.emit("close", 0);
    await pending;
    expect(spawnMock.mock.calls[0][0]).toBe("C:/python/python.exe");
    if (previous === undefined) delete process.env.PYTHON_EXECUTABLE;
    else process.env.PYTHON_EXECUTABLE = previous;
  });

  it("sends JSON without a shell and parses the worker response", async () => {
    const child = createChild();
    const request = { query: "remote analyst", userBlockers: [] };
    const pending = runJobsWorker(request, { timeoutMs: 100 });
    child.stdout.emit("data", '{"jobs":[],"blocked_jobs":[],"summary":{}}');
    child.emit("close", 0);

    await expect(pending).resolves.toEqual({ jobs: [], blocked_jobs: [], summary: {} });
    expect(spawnMock).toHaveBeenCalledWith(
      expect.any(String),
      ["jobs_api.py"],
      expect.objectContaining({ shell: false, stdio: ["pipe", "pipe", "pipe"] }),
    );
    expect(child.stdin.end).toHaveBeenCalledWith(JSON.stringify(request));
  });

  it("maps Python cache failures without exposing worker details", async () => {
    const child = createChild();
    const pending = runJobsWorker({ query: "remote", userBlockers: [] }, { timeoutMs: 100 });
    child.stdout.emit("data", '{"error":"cache_unavailable"}');
    child.stderr.emit("data", "private traceback");
    child.emit("close", 1);

    await expect(pending).rejects.toMatchObject({ code: "cache_unavailable" });
  });

  it("kills a worker that exceeds its timeout", async () => {
    vi.useFakeTimers();
    const child = createChild();
    const pending = runJobsWorker({ query: "remote", userBlockers: [] }, { timeoutMs: 5 });
    const assertion = expect(pending).rejects.toBeInstanceOf(JobsWorkerError);
    await vi.advanceTimersByTimeAsync(5);
    await assertion;
    expect(child.kill).toHaveBeenCalledOnce();
  });
});
