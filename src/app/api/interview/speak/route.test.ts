import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { speakMock } = vi.hoisted(() => ({ speakMock: vi.fn() }));
vi.mock("@/lib/kokoro", async (original) => ({
  ...(await original<typeof import("@/lib/kokoro")>()),
  speakToFile: speakMock,
}));

const { POST } = await import("@/app/api/interview/speak/route");
const { VoiceError } = await import("@/lib/kokoro");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/interview/speak", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/interview/speak", () => {
  // Braces matter: a function returned from beforeEach runs as cleanup, and mockReset() returns the mock itself.
  beforeEach(() => {
    speakMock.mockReset();
  });

  it("returns the spoken sentence as WAV audio, and the file is gone afterwards", async () => {
    speakMock.mockImplementation(async (...args: unknown[]) => {
      await writeFile(String(args[1]), Buffer.from("RIFF-fake-wav"));
    });
    const res = await post({ text: "  Tell me about yourself.  " });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("RIFF-fake-wav");
    const [text, path] = speakMock.mock.calls[0];
    expect(text).toBe("Tell me about yourself.");
    expect(String(path)).toMatch(/constela-speech-.+\.wav$/);
    expect(existsSync(String(path))).toBe(false);
  });

  it.each([
    ["broken JSON", "{nope"],
    ["empty text", { text: "   " }],
    ["very long text", { text: "x".repeat(601) }],
    ["extra fields", { text: "Hi", voice: "other" }],
    ["a speed out of range", { text: "Hi", speed: 4 }],
  ])("rejects %s without running Kokoro", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(speakMock).not.toHaveBeenCalled();
  });

  it.each([
    ["unavailable", 503],
    ["timeout", 504],
    ["failed", 502],
  ] as const)("maps %s from Kokoro", async (code, status) => {
    speakMock.mockRejectedValue(new VoiceError(code));
    const res = await post({ text: "Hello." });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code });
  });
});
