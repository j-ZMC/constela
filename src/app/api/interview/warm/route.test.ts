import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { warmWhisperMock, warmVoiceMock } = vi.hoisted(() => ({ warmWhisperMock: vi.fn(), warmVoiceMock: vi.fn() }));
vi.mock("@/lib/whisper", () => ({ warmWhisper: warmWhisperMock }));
vi.mock("@/lib/kokoro", () => ({ warmVoice: warmVoiceMock }));

const { POST } = await import("@/app/api/interview/warm/route");
const fetchMock = vi.fn();
const post = (body?: unknown) =>
  POST(new Request("http://localhost/api/interview/warm", { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));

describe("POST /api/interview/warm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OLLAMA_URL", "");
    vi.stubEnv("OLLAMA_MODEL", "");
    fetchMock.mockReset();
    warmWhisperMock.mockReset();
    warmVoiceMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loads the model with the chat's settings and reads only the shared rules", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    const res = await post();
    expect(res.status).toBe(204);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({ model: "llama3.1:8b", keep_alive: "30m", stream: false, options: { num_ctx: 8192, num_predict: 1 } });
    expect(sent.messages.map((m: { role: string }) => m.role)).toEqual(["system"]);
    expect(warmWhisperMock).not.toHaveBeenCalled();
  });

  it("starts Whisper when the person will talk, and Kokoro when the AI will", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    await post({ voice: true, speak: true });
    expect(warmWhisperMock).toHaveBeenCalledTimes(1);
    expect(warmVoiceMock).toHaveBeenCalledTimes(1);
    warmWhisperMock.mockReset();
    warmVoiceMock.mockReset();
    await post({ speak: true });
    expect(warmWhisperMock).not.toHaveBeenCalled();
    expect(warmVoiceMock).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when Ollama is not running", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect((await post()).status).toBe(204);
  });
});
