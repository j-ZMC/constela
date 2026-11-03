import {
  KEEP_ALIVE,
  MODEL_OPTIONS,
  buildMessages,
  interviewRequest,
  ollamaModel,
  ollamaTextStream,
  ollamaUrl,
  type InterviewErrorCode,
} from "@/lib/interview";

// The first answer can wait for the model to load into memory.
const TIMEOUT_MS = 120_000;

const STATUS: Record<InterviewErrorCode, number> = { invalid_input: 400, unavailable: 503, timeout: 504, failed: 502 };

function fail(error: InterviewErrorCode) {
  return Response.json({ error }, { status: STATUS[error] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = interviewRequest.safeParse(body);
  if (!parsed.success) return fail("invalid_input");

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(`${ollamaUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel(),
        messages: buildMessages(parsed.data),
        stream: true,
        keep_alive: KEEP_ALIVE,
        options: { ...MODEL_OPTIONS, temperature: 0.6, num_predict: 300 },
      }),
      signal,
    });
  } catch {
    // No answer at all means Ollama is not running; a timeout means the model never got going.
    return fail(signal.aborted ? "timeout" : "unavailable");
  }
  if (!upstream.ok || !upstream.body) return fail("failed");

  return new Response(ollamaTextStream(upstream.body), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
