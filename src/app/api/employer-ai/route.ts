import { createGroq } from "@ai-sdk/groq";
import { EmployerAiError, employerAiRequest, runEmployerAi, type EmployerAiErrorCode } from "@/lib/employer-ai";

// Same model as /api/breakdown; override with GROQ_MODEL when Groq retires it.
const DEFAULT_MODEL = "openai/gpt-oss-20b";

const STATUS: Record<EmployerAiErrorCode, number> = { invalid_input: 400, not_configured: 503, timeout: 504, failed: 502 };

function fail(error: EmployerAiErrorCode) {
  return Response.json({ error }, { status: STATUS[error] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = employerAiRequest.safeParse(body);
  if (!parsed.success) return fail("invalid_input");

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return fail("not_configured");

  const modelId = process.env.GROQ_MODEL || DEFAULT_MODEL;
  try {
    return Response.json(await runEmployerAi(parsed.data, createGroq({ apiKey })(modelId)));
  } catch (error) {
    return fail(error instanceof EmployerAiError ? error.code : "failed");
  }
}
