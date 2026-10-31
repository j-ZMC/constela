import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { runResumeParser, ResumeWorkerError } from "@/lib/resume-worker";

function childProcess() {
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

describe("runResumeParser", () => {
  it("runs the parser without a shell and returns JSON", async () => {
    const child = childProcess();
    const pending = runResumeParser("C:/temp/resume.pdf", { timeoutMs: 100 });
    child.stdout.emit("data", '{"name":"Jesus","skills_found":[]}');
    child.emit("close", 0);

    await expect(pending).resolves.toEqual({ name: "Jesus", skills_found: [] });
    expect(spawnMock).toHaveBeenCalledWith(
      expect.any(String),
      ["resume_api.py", "C:/temp/resume.pdf"],
      expect.objectContaining({ shell: false }),
    );
  });

  it("maps a timeout to a generic worker error", async () => {
    vi.useFakeTimers();
    const child = childProcess();
    const pending = runResumeParser("C:/temp/resume.pdf", { timeoutMs: 5 });
    const assertion = expect(pending).rejects.toBeInstanceOf(ResumeWorkerError);
    await vi.advanceTimersByTimeAsync(5);
    await assertion;
    expect(child.kill).toHaveBeenCalledOnce();
  });
});
