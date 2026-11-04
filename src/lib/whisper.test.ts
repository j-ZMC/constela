import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for transcribe_server.py: what the code writes to stdin, and what "Python" answers on stdout.
type FakeChild = EventEmitter & { stdin: PassThrough; stdout: PassThrough; stderr: PassThrough; say: (m: object) => void; sent: () => Array<{ id: string; path: string }> };
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

function fakeChild(): FakeChild {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() }) as FakeChild;
  const written: string[] = [];
  child.stdin.on("data", (chunk) => written.push(String(chunk)));
  child.say = (m) => child.stdout.write(`${JSON.stringify(m)}\n`);
  child.sent = () => written.join("").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return child;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("whisper worker", () => {
  let child: FakeChild;
  beforeEach(() => {
    vi.resetModules();
    (globalThis as { __constelaWorkers?: unknown }).__constelaWorkers = undefined;
    child = fakeChild();
    spawnMock.mockReset().mockReturnValue(child);
  });
  afterEach(() => vi.useRealTimers());

  it("waits for the model, sends the recording and returns its text", async () => {
    const { transcribe } = await import("@/lib/whisper");
    const result = transcribe("C:/tmp/a.webm");
    await tick();
    expect(child.sent()).toEqual([]); // nothing is sent before the model is ready
    child.say({ ready: true, device: "cuda" });
    await tick();
    const [{ id, path }] = child.sent();
    expect(path).toBe("C:/tmp/a.webm");
    child.say({ id, text: "I like working with people" });
    await expect(result).resolves.toBe("I like working with people");
  });

  it("starts Python only once for many recordings, and matches each answer to its request", async () => {
    const { transcribe, warmWhisper } = await import("@/lib/whisper");
    warmWhisper();
    child.say({ ready: true, device: "cpu" });
    const one = transcribe("one.webm");
    const two = transcribe("two.webm");
    await tick();
    const [a, b] = child.sent();
    child.say({ id: b.id, text: "second" });
    child.say({ id: a.id, text: "first" });
    await expect(one).resolves.toBe("first");
    await expect(two).resolves.toBe("second");
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("ignores lines that are not its protocol, such as library logs", async () => {
    const { transcribe } = await import("@/lib/whisper");
    const result = transcribe("a.webm");
    child.stdout.write("Downloading model...\n");
    child.say({ ready: true, device: "cuda" });
    await tick();
    child.say({ id: child.sent()[0].id, text: "ok" });
    await expect(result).resolves.toBe("ok");
  });

  it("reports a failed recording without stopping the worker", async () => {
    const { transcribe } = await import("@/lib/whisper");
    child.say({ ready: true, device: "cuda" });
    const bad = transcribe("bad.webm");
    await tick();
    child.say({ id: child.sent()[0].id, error: "could not decode" });
    await expect(bad).rejects.toMatchObject({ code: "failed" });
    const good = transcribe("good.webm");
    await tick();
    child.say({ id: child.sent()[1].id, text: "fine" });
    await expect(good).resolves.toBe("fine");
  });

  it("says unavailable when Python stops, and starts a new worker next time", async () => {
    const { transcribe } = await import("@/lib/whisper");
    const waiting = transcribe("a.webm");
    child.emit("exit", 1);
    await expect(waiting).rejects.toMatchObject({ code: "unavailable" });
    const next = fakeChild();
    spawnMock.mockReturnValue(next);
    const again = transcribe("b.webm");
    next.say({ ready: true, device: "cuda" });
    await tick();
    next.say({ id: next.sent()[0].id, text: "back" });
    await expect(again).resolves.toBe("back");
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it("times out when the model never gets ready or a recording takes too long", async () => {
    const { transcribe } = await import("@/lib/whisper");
    await expect(transcribe("a.webm", { readyMs: 20 })).rejects.toMatchObject({ code: "timeout" });
    child.say({ ready: true, device: "cuda" });
    await expect(transcribe("b.webm", { timeoutMs: 20 })).rejects.toMatchObject({ code: "timeout" });
  });
});
