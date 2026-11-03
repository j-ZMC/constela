import { publicJson, publicOptions } from "@/app/api/public/cors";
import { MAX_COMPANY_CHARS, publicSeal } from "@/lib/public-employer";
import { readSnapshot } from "@/lib/public-store";

export const OPTIONS = publicOptions;

// A company with no seal is a normal answer, because an extension asks about every company it sees.
export async function GET(req: Request) {
  const company = new URL(req.url).searchParams.get("company")?.trim();
  if (!company || company.length > MAX_COMPANY_CHARS) return publicJson({ error: "invalid_input" }, 400);
  return publicJson(publicSeal(await readSnapshot(), company, new Date()));
}
