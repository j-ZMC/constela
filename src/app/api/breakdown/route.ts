import { BreakdownError, breakdown, breakdownRequest, type BreakdownErrorCode } from "@/lib/breakdown";

// The steps come from Ollama on this computer (src/lib/breakdown.ts); no key, nothing leaves the computer.
const STATUS: Record<BreakdownErrorCode, number> = { invalid_input: 400, timeout: 504, failed: 502 };

function fail(error: BreakdownErrorCode) {
  return Response.json({ error }, { status: STATUS[error] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = breakdownRequest.safeParse(body);
  if (!parsed.success) return fail("invalid_input");

  try {
    const steps = await breakdown(parsed.data);
    return Response.json({ steps });
  } catch (error) {
    return fail(error instanceof BreakdownError ? error.code : "failed");
  }
}
