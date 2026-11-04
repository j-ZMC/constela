import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { transcribeMock, voiceMock } = vi.hoisted(() => ({ transcribeMock: vi.fn(), voiceMock: vi.fn() }));
vi.mock("@/lib/whisper", async (original) => ({
  ...(await original<typeof import("@/lib/whisper")>()),
  transcribe: transcribeMock,
  transcribeWithVoice: voiceMock,
}));

const { POST } = await import("@/app/api/interview/transcribe/route");
const { WhisperError } = await import("@/lib/whisper");

function post(file?: Blob, name = "answer.webm", measure = false) {
  const form = new FormData();
  if (file !== undefined) form.set("audio", file, name);
  if (measure) form.set("voice", "1");
  return POST(new Request("http://localhost/api/interview/transcribe", { method: "POST", body: form }));
}
const voice = (bytes = 100, type = "audio/webm;codecs=opus") => new Blob([new Uint8Array(bytes).fill(7)], { type });

describe("POST /api/interview/transcribe", () => {
  // Braces matter: a function returned from beforeEach runs as cleanup, and mockReset() returns the mock itself.
  beforeEach(() => {
    transcribeMock.mockReset();
    voiceMock.mockReset();
  });

  it("measures the voice only when the person turned it on, and still deletes the recording", async () => {
    voiceMock.mockResolvedValue({ text: "I don't know", voice: { seconds: 4, pauses: 0.3 } });
    const res = await post(voice(), "answer.webm", true);
    expect(await res.json()).toEqual({ text: "I don't know", voice: { seconds: 4, pauses: 0.3 } });
    expect(transcribeMock).not.toHaveBeenCalled();
    expect(existsSync(String(voiceMock.mock.calls[0][0]))).toBe(false);
    transcribeMock.mockResolvedValue("Hello");
    await post(voice());
    expect(voiceMock).toHaveBeenCalledTimes(1);
  });

  it("gives Whisper the saved recording, returns the text, and deletes the recording afterwards", async () => {
    let size = -1;
    transcribeMock.mockImplementation(async (...args: unknown[]) => {
      size = (await readFile(String(args[0]))).length;
      return "I like working with people";
    });
    const res = await post(voice());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "I like working with people" });
    const path = String(transcribeMock.mock.calls[0][0]);
    expect(path).toMatch(/constela-voice-.+\.webm$/);
    expect(size).toBe(100);
    expect(existsSync(path)).toBe(false);
  });

  it("deletes the recording when Whisper fails too", async () => {
    transcribeMock.mockRejectedValue(new WhisperError("failed"));
    const res = await post(voice());
    expect(res.status).toBe(502);
    expect(existsSync(String(transcribeMock.mock.calls[0][0]))).toBe(false);
  });

  it.each([
    ["no file", undefined],
    ["an empty recording", voice(0)],
    ["a file that is not audio", new Blob(["<script>"], { type: "text/html" })],
    ["a recording that is too long", voice(5 * 1024 * 1024 + 1)],
  ])("rejects %s without running Whisper", async (_, file) => {
    const res = await post(file);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it.each([
    ["unavailable", 503],
    ["timeout", 504],
    ["failed", 502],
  ] as const)("maps %s from Whisper", async (code, status) => {
    transcribeMock.mockRejectedValue(new WhisperError(code));
    const res = await post(voice());
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code });
  });
});
