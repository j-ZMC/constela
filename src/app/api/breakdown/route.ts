import { createGroq } from "@ai-sdk/groq";
import { BreakdownError, breakdown, breakdownRequest, type BreakdownErrorCode } from "@/lib/breakdown";

// Fast model with strict structured output on Groq; override with GROQ_MODEL when Groq retires it.
const DEFAULT_MODEL = "openai/gpt-oss-20b";

const STATUS: Record<BreakdownErrorCode, number> = { invalid_input: 400, not_configured: 503, timeout: 504, failed: 502 };

function fail(error: BreakdownErrorCode) {
  return Response.json({ error }, { status: STATUS[error] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = breakdownRequest.safeParse(body);
  if (!parsed.success) return fail("invalid_input");

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return fail("not_configured");

  const modelId = process.env.GROQ_MODEL || DEFAULT_MODEL;
  try {
    const steps = await breakdown(parsed.data, createGroq({ apiKey })(modelId));
    return Response.json({ steps });
  } catch (error) {
    return fail(error instanceof BreakdownError ? error.code : "failed");
  }
}
