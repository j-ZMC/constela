import { createGroq } from "@ai-sdk/groq";
import { InterviewError, interview, interviewRequest, type InterviewErrorCode } from "@/lib/interview";

// Same model and errors as /api/breakdown; override with GROQ_MODEL when Groq retires it.
const DEFAULT_MODEL = "openai/gpt-oss-20b";

const STATUS: Record<InterviewErrorCode, number> = { invalid_input: 400, not_configured: 503, timeout: 504, failed: 502 };

function fail(error: InterviewErrorCode) {
  return Response.json({ error }, { status: STATUS[error] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = interviewRequest.safeParse(body);
  if (!parsed.success) return fail("invalid_input");

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return fail("not_configured");

  const modelId = process.env.GROQ_MODEL || DEFAULT_MODEL;
  try {
    return Response.json(await interview(parsed.data, createGroq({ apiKey })(modelId)));
  } catch (error) {
    return fail(error instanceof InterviewError ? error.code : "failed");
  }
}
