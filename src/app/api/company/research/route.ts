import { ResearchError, researchCompany, researchRequest } from "@/lib/company-research";

const STATUS = { not_configured: 503, timeout: 504, failed: 502 } as const;

export async function POST(req: Request) {
  const parsed = researchRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  try {
    return Response.json(await researchCompany(parsed.data));
  } catch (error) {
    const code = error instanceof ResearchError ? error.code : "failed";
    return Response.json({ error: code }, { status: STATUS[code] });
  }
}
