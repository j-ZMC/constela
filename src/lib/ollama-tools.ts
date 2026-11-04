// The AI on this computer (Ollama) for "Look up" and "Experience they ask for": it answers in a fixed JSON shape.
// Server only.
import { KEEP_ALIVE, MODEL_OPTIONS, ollamaModel, ollamaUrl } from "@/lib/interview";

export type WebResult = { title: string; url: string; content: string };
export type OllamaErrorCode = "not_configured" | "timeout" | "failed";

export class OllamaError extends Error {
  constructor(public readonly code: OllamaErrorCode) {
    super(code);
  }
}

const failure = (error: unknown) =>
  error instanceof OllamaError ? error : new OllamaError(error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "failed");

// Pages as numbered blocks the model can point to by number, so it never has to copy a link.
export const numbered = (results: WebResult[]) =>
  results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join("\n\n");

// The local model's answer, held to `schema` by Ollama's structured output.
export async function localJson(prompt: string, schema: object, timeoutMs = 90_000): Promise<unknown> {
  try {
    const res = await fetch(`${ollamaUrl()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel(),
        messages: [{ role: "user", content: prompt }],
        format: schema,
        stream: false,
        // Same num_ctx as the Interview chat, so Ollama does not reload the model between them.
        options: { ...MODEL_OPTIONS, temperature: 0 },
        keep_alive: KEEP_ALIVE,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new OllamaError("failed");
    const data = (await res.json()) as { message?: { content?: string } };
    return JSON.parse(data.message?.content ?? "");
  } catch (error) {
    throw failure(error);
  }
}
