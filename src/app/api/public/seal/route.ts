import { publicJson, publicOptions } from "@/app/api/public/cors";
import { MAX_COMPANY_CHARS } from "@/lib/public-employer";
import { readSnapshot } from "@/lib/public-store";
import { signedSeal } from "@/lib/seal-log";

export const OPTIONS = publicOptions;

// A company with no seal is a normal answer, because an extension asks about every company it sees.
// The token lets anyone check the answer without trusting whoever passed it on: see /seal-check.
export async function GET(req: Request) {
  const company = new URL(req.url).searchParams.get("company")?.trim();
  if (!company || company.length > MAX_COMPANY_CHARS) return publicJson({ error: "invalid_input" }, 400);
  return publicJson(await signedSeal(await readSnapshot(), company, new Date()));
}
