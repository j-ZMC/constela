import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/interview/route";

const fetchMock = vi.fn();
const valid = { role: "Cashier", messages: [{ role: "user", content: "I am ready." }] };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/interview", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const ollama = (...lines: unknown[]) =>
  new Response(lines.map((l) => `${JSON.stringify(l)}\n`).join(""), { status: 200 });

describe("POST /api/interview", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OLLAMA_URL", "");
    vi.stubEnv("OLLAMA_MODEL", "");
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("streams the text of the model's answer", async () => {
    fetchMock.mockResolvedValue(ollama({ message: { content: "Hello" } }, { message: { content: " there" }, done: true }));
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello there");
  });

  it("calls the local llama3.1:8b model by default, with the rules and only the chat", async () => {
    fetchMock.mockResolvedValue(ollama({ message: { content: "x" } }));
    await post(valid);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("llama3.1:8b");
    expect(sent.stream).toBe(true);
    // A small window and a long keep-alive: a fast load, and no reload after five idle minutes.
    expect(sent.options.num_ctx).toBe(8192);
    expect(sent.keep_alive).toBe("30m");
    expect(sent.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
  });

  it("uses OLLAMA_URL and OLLAMA_MODEL when set", async () => {
    vi.stubEnv("OLLAMA_URL", "http://other:1234");
    vi.stubEnv("OLLAMA_MODEL", "qwen3:8b");
    fetchMock.mockResolvedValue(ollama({ message: { content: "x" } }));
    await post(valid);
    expect(fetchMock.mock.calls[0][0]).toBe("http://other:1234/api/chat");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("qwen3:8b");
  });

  it.each([
    ["broken JSON", "{nope"],
    ["profile data", { ...valid, sensory: ["noise"] }],
    ["a chat that ends with the interviewer", { messages: [{ role: "assistant", content: "Hi" }] }],
  ])("rejects %s without calling the model", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says unavailable when Ollama is not running", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await post(valid);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it("says failed when Ollama answers with an error, such as a missing model", async () => {
    fetchMock.mockResolvedValue(new Response("model not found", { status: 404 }));
    const res = await post(valid);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "failed" });
  });
});
